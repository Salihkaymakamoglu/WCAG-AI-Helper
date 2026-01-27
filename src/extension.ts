import * as vscode from "vscode";
import { analyzeDocument, A11yIssue } from "./analyzer";
import { RULES } from "./rules";
import { getAiSuggestion } from "./aiClient";

let diagnosticCollection: vscode.DiagnosticCollection;

// Simple safety check to avoid applying obviously bad AI suggestions
function isSafeReplacement(
  originalSnippet: string,
  suggestedSnippet: string
): { safe: boolean; reason?: string } {
  const original = originalSnippet.trim();
  const suggested = suggestedSnippet.trim();

  // Suggested snippet must not be empty
  if (!suggested) {
    return { safe: false, reason: "AI returned an empty suggestion." };
  }

  // Length ratio must be within a reasonable range
  if (original.length > 0) {
    const ratio = suggested.length / original.length;
    if (ratio < 0.25 || ratio > 4) {
      return {
        safe: false,
        reason:
          "The AI suggestion is dramatically shorter or longer than the original snippet.",
      };
    }
  }

  // If original looks like HTML, suggested should also look like HTML
  const looksHtmlOriginal = /<\w+/.test(original);
  const looksHtmlSuggested = /<\w+/.test(suggested);
  if (looksHtmlOriginal && !looksHtmlSuggested) {
    return {
      safe: false,
      reason: "The AI suggestion no longer looks like valid HTML markup.",
    };
  }

  // Basic injection guard: do not introduce <script> if there was none
  const hadScript = /<\s*script\b/i.test(original);
  const hasScriptNow = /<\s*script\b/i.test(suggested);
  if (!hadScript && hasScriptNow) {
    return {
      safe: false,
      reason:
        "The AI suggestion introduces a <script> tag that was not present before.",
    };
  }

  // Avoid adding javascript: URLs if none existed
  const hadJsUrl = /javascript:/i.test(original);
  const hasJsUrlNow = /javascript:/i.test(suggested);
  if (!hadJsUrl && hasJsUrlNow) {
    return {
      safe: false,
      reason:
        'The AI suggestion introduces a "javascript:" URL that was not present before.',
    };
  }

  return { safe: true };
}

// Build an explanation for a given rule
function buildRuleExplanation(
  ruleId: string,
  rule: {
    id: string;
    description: string;
    wcagRef: string;
  }
): string {
  switch (ruleId) {
    case "R1_IMG_ALT":
      return (
        `# ${rule.id} - Images must have meaningful alt text\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `Screen reader users rely on \`alt\` text to understand the purpose of images. ` +
        `If the alt text is missing or empty for meaningful images, important information is lost.\n\n` +
        `## Problematic example\n\n` +
        "```html\n" +
        `<img src="hero.jpg">\n` +
        "```\n\n" +
        `## Improved example\n\n` +
        "```html\n" +
        `<img src="hero.jpg" alt="Hero banner showing our main product">` +
        "\n```"
      );

    case "R2_LABEL":
      return (
        `# ${rule.id} - Form controls must have an accessible name\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `Without an accessible name, screen reader users will hear generic labels like "edit text" ` +
        `instead of meaningful names like "Username" or "Email". This makes forms hard or impossible to complete.\n\n` +
        `## Problematic example\n\n` +
        "```html\n" +
        `<input id="username" type="text">\n` +
        "```\n\n" +
        `## Improved examples\n\n` +
        "Using a label:\n\n" +
        "```html\n" +
        `<label for="username">Username</label>\n` +
        `<input id="username" type="text">\n` +
        "```\n\n" +
        "Using aria-label:\n\n" +
        "```html\n" +
        `<input id="username" type="text" aria-label="Username">\n` +
        "```"
      );

    case "R3_BUTTON":
      return (
        `# ${rule.id} - Buttons need visible or accessible text\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `Buttons without a clear name are announced as "button" with no context. Users cannot tell what action will occur.\n\n` +
        `## Problematic example\n\n` +
        "```html\n" +
        `<button></button>\n` +
        "```\n\n" +
        `## Improved examples\n\n` +
        "```html\n" +
        `<button>Submit</button>\n` +
        "```\n\n" +
        "Icon-only button with aria-label:\n\n" +
        "```html\n" +
        `<button aria-label="Close dialog">\n` +
        `  <svg aria-hidden="true">...</svg>\n` +
        `</button>\n` +
        "```"
      );

    case "R4_LINK":
      return (
        `# ${rule.id} - Links should have descriptive text\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `When link text is vague (e.g., "click here"), screen reader users cannot understand where the link goes, ` +
        `especially when navigating a list of links.\n\n` +
        `## Problematic example\n\n` +
        "```html\n" +
        `<a href="/details">click here</a>\n` +
        "```\n\n" +
        `## Improved example\n\n` +
        "```html\n" +
        `<a href="/details">View product details</a>\n` +
        "```"
      );

    case "R5_H1":
      return (
        `# ${rule.id} - Use a clear main heading structure\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `Headings define the outline of a page. A clear main heading helps screen reader users understand page structure ` +
        `and quickly determine what the page is about.\n\n` +
        `## Problematic example (multiple competing main headings)\n\n` +
        "```html\n" +
        `<h1>Products</h1>\n` +
        `<h1>Support</h1>\n` +
        "```\n\n" +
        `## Improved example\n\n` +
        "```html\n" +
        `<h1>Products</h1>\n` +
        `<h2>Support</h2>\n` +
        "```"
      );

    case "R6_TABINDEX":
      return (
        `# ${rule.id} - Avoid positive tabindex values\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `Positive tabindex values create a custom focus order that can become confusing and fragile. ` +
        `They often cause keyboard users to jump around the page in unexpected ways.\n\n` +
        `## Problematic example\n\n` +
        "```html\n" +
        `<a href="#content" tabindex="3">Skip to content</a>\n` +
        "```\n\n" +
        `## Improved example\n\n` +
        "```html\n" +
        `<a href="#content">Skip to content</a>\n` +
        "```"
      );

    case "R7_ROLE_BUTTON":
      return (
        `# ${rule.id} - Custom buttons must be keyboard accessible\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `## Why this matters\n\n` +
        `When using \`role="button"\` on non-button elements, you must manually provide keyboard support. ` +
        `Otherwise, keyboard and screen reader users may not be able to activate the control.\n\n` +
        `## Problematic example\n\n` +
        "```html\n" +
        `<div role="button" onclick="openDialog()">Open dialog</div>\n` +
        "```\n\n" +
        `## Improved example\n\n` +
        "```html\n" +
        `<div\n` +
        `  role="button"\n` +
        `  tabindex="0"\n` +
        `  onclick="openDialog()"\n` +
        `  onkeydown="if (event.key === 'Enter' || event.key === ' ') openDialog()"\n` +
        `>\n` +
        `  Open dialog\n` +
        `</div>\n` +
        "```"
      );

    default:
      return (
        `# ${rule.id}\n\n` +
        `**WCAG reference:** ${rule.wcagRef}\n\n` +
        `${rule.description}\n\n` +
        `This rule currently has no extended explanation configured.`
      );
  }
}

// Code Action Provider
class A11yCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] | undefined {
    // Only offer actions for this extension
    const a11yDiagnostic = context.diagnostics.find(
      (d) => d.source === "wcag-ai-helper"
    );

    if (!a11yDiagnostic) {
      return;
    }

    const actions: vscode.CodeAction[] = [];

    const aiAction = new vscode.CodeAction(
      "Ask WCAG AI Helper (suggest fix)",
      vscode.CodeActionKind.QuickFix
    );
    aiAction.command = {
      title: "Ask WCAG AI Helper",
      command: "wcag-ai-helper.askAiSuggestion",
      arguments: [a11yDiagnostic],
    };
    actions.push(aiAction);

    const explainAction = new vscode.CodeAction(
      "Explain this accessibility rule (WCAG)",
      vscode.CodeActionKind.QuickFix
    );
    explainAction.command = {
      title: "Explain this accessibility rule",
      command: "wcag-ai-helper.explainRule",
      arguments: [a11yDiagnostic],
    };
    actions.push(explainAction);

    return actions;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "wcag-ai-helper" is now active.');

  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("wcag-ai-helper");
  context.subscriptions.push(diagnosticCollection);

  const scanCmd = vscode.commands.registerCommand(
    "wcag-ai-helper.scanFile",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor to analyze.");
        return;
      }

      runAnalysis(editor.document);
    }
  );
  context.subscriptions.push(scanCmd);

  const explainRuleCmd = vscode.commands.registerCommand(
    "wcag-ai-helper.explainRule",
    async (diagnosticFromCodeAction?: vscode.Diagnostic) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
      }
      const doc = editor.document;

      if (!diagnosticCollection) {
        vscode.window.showInformationMessage("No diagnostics available.");
        return;
      }

      let targetDiagnostic: vscode.Diagnostic | undefined;

      if (diagnosticFromCodeAction) {
        targetDiagnostic = diagnosticFromCodeAction;
      } else {
        const position = editor.selection.active;
        const diagnostics = diagnosticCollection.get(doc.uri) ?? [];
        targetDiagnostic = diagnostics.find(
          (d) => d.source === "wcag-ai-helper" && d.range.contains(position)
        );
      }

      if (!targetDiagnostic) {
        vscode.window.showInformationMessage(
          "No accessibility issue found to explain."
        );
        return;
      }

      const ruleId = targetDiagnostic.code?.toString() ?? "";
      const rule = RULES.find((r) => r.id === ruleId) ?? {
        id: ruleId || "Unknown rule",
        description: "No description available.",
        wcagRef: "N/A",
      };

      const markdown = buildRuleExplanation(ruleId || rule.id, rule);

      const explanationDoc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: markdown,
      });

      await vscode.window.showTextDocument(explanationDoc, {
        preview: true,
      });
    }
  );
  context.subscriptions.push(explainRuleCmd);

  const aiCmd = vscode.commands.registerCommand(
    "wcag-ai-helper.askAiSuggestion",
    async (diagnosticFromCodeAction?: vscode.Diagnostic) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
      }

      const doc = editor.document;

      if (!diagnosticCollection) {
        vscode.window.showInformationMessage("No diagnostics available.");
        return;
      }

      let targetDiagnostic: vscode.Diagnostic | undefined;

      if (diagnosticFromCodeAction) {
        targetDiagnostic = diagnosticFromCodeAction;
      } else {
        const position = editor.selection.active;
        const diagnostics = diagnosticCollection.get(doc.uri) ?? [];
        targetDiagnostic = diagnostics.find(
          (d) => d.source === "wcag-ai-helper" && d.range.contains(position)
        );
      }

      if (!targetDiagnostic) {
        vscode.window.showInformationMessage(
          "No accessibility issue found to ask AI about."
        );
        return;
      }

      const ruleId = targetDiagnostic.code?.toString() ?? "";
      const rule = RULES.find((r) => r.id === ruleId);

      if (!rule) {
        vscode.window.showInformationMessage(
          "Could not identify rule for this diagnostic."
        );
        return;
      }

      // Get a small snippet around the diagnostic line for context
      const diagLine = targetDiagnostic.range.start.line;
      const startLine = Math.max(diagLine - 2, 0);
      const endLine = Math.min(diagLine + 2, doc.lineCount - 1);
      const snippetRange = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, doc.lineAt(endLine).text.length)
      );
      const codeSnippet = doc.getText(snippetRange);

      try {
        vscode.window.showInformationMessage(
          "Asking AI for accessibility suggestion…"
        );

        const fixedCode = await getAiSuggestion({
          ruleId: rule.id,
          ruleDescription: rule.description,
          wcagRef: rule.wcagRef,
          codeSnippet,
          languageId: doc.languageId,
        });

        const choice = await vscode.window.showInformationMessage(
          "AI generated a suggested fix for this snippet.",
          "Apply fix",
          "View suggestion",
          "Cancel"
        );

        if (choice === "Apply fix") {
          const safety = isSafeReplacement(codeSnippet, fixedCode);
          if (!safety.safe) {
            vscode.window.showWarningMessage(
              `AI suggestion was not applied automatically: ${
                safety.reason ?? "failed safety checks."
              } ` +
                "You can choose 'View suggestion' to inspect and edit it manually."
            );
            return;
          }

          const edit = new vscode.WorkspaceEdit();
          edit.replace(doc.uri, snippetRange, fixedCode);
          const success = await vscode.workspace.applyEdit(edit);
          if (success) {
            await doc.save();
            vscode.window.showInformationMessage("AI fix applied.");
            // Re-run analysis after applying the fix
            runAnalysis(doc);
          } else {
            vscode.window.showErrorMessage("Failed to apply AI fix.");
          }
          return;
        }

        if (choice === "View suggestion") {
          const suggestionDoc = await vscode.workspace.openTextDocument({
            language: "markdown",
            content:
              `# AI Accessibility Suggestion\n\n` +
              `WCAG: ${rule.wcagRef}\n\n` +
              `Rule: ${rule.description}\n\n` +
              `## Suggested fixed code\n\n` +
              "```" +
              `${doc.languageId}\n` +
              fixedCode +
              "\n```",
          });
          await vscode.window.showTextDocument(suggestionDoc, {
            preview: true,
          });

          // After showing the suggestion offer to apply it
          const applyChoice = await vscode.window.showInformationMessage(
            "Apply this AI suggestion to the original file?",
            "Apply fix",
            "Close"
          );

          if (applyChoice === "Apply fix") {
            const safety = isSafeReplacement(codeSnippet, fixedCode);
            if (!safety.safe) {
              vscode.window.showWarningMessage(
                `AI suggestion was not applied automatically: ${
                  safety.reason ?? "failed safety checks."
                } ` +
                  "Please review and copy any useful parts manually from the suggestion document."
              );
              return;
            }

            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, snippetRange, fixedCode);
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
              await doc.save();
              vscode.window.showInformationMessage("AI fix applied.");
              // Re-run analysis after applying the fix
              runAnalysis(doc);
            } else {
              vscode.window.showErrorMessage("Failed to apply AI fix.");
            }
          }

          return;
        }

      } catch (err: any) {
        vscode.window.showErrorMessage(
          `AI suggestion failed: ${err.message ?? String(err)}`
        );
      }
    }
  );
  context.subscriptions.push(aiCmd);

  // Quick Fix provider (hover → lightbulb → Ask WCAG AI Helper / Explain rule)
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    ["html", "javascriptreact", "typescriptreact", "razor", "aspnetcorerazor"],
    new A11yCodeActionProvider(),
    {
      providedCodeActionKinds: A11yCodeActionProvider.providedCodeActionKinds,
    }
  );
  context.subscriptions.push(codeActionProvider);

  // Auto-analyze on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      runAnalysis(doc);
    })
  );

  // Auto-analyze on every text change (for supported languages)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const doc = event.document;
      const supportedLanguages = [
        "html",
        "javascriptreact",
        "typescriptreact",
        "razor",
        "aspnetcorerazor",
      ];
      if (supportedLanguages.includes(doc.languageId)) {
        runAnalysis(doc);
      }
    })
  );
}

function runAnalysis(doc: vscode.TextDocument) {
  if (!diagnosticCollection) {
    return;
  }

  // supported languages for this version
  const supportedLanguages = [
    "html",
    "javascriptreact",
    "typescriptreact",
    "razor",
    "aspnetcorerazor",
  ];
  if (!supportedLanguages.includes(doc.languageId)) {
    diagnosticCollection.delete(doc.uri);
    return;
  }

  const issues: A11yIssue[] = analyzeDocument(doc);

  const diagnostics: vscode.Diagnostic[] = issues.map((issue) => {
    const start = new vscode.Position(issue.line, issue.column);
    const end = new vscode.Position(issue.line, issue.column + 1);
    const range = new vscode.Range(start, end);

    const diagnostic = new vscode.Diagnostic(
      range,
      `${issue.message} [${issue.ruleId}]`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = "wcag-ai-helper";
    diagnostic.code = issue.ruleId; 
    return diagnostic;
  });

  diagnosticCollection.set(doc.uri, diagnostics);

  vscode.window.setStatusBarMessage(
    `WCAG scan: found ${diagnostics.length} issue(s).`,
    4000
  );
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}
