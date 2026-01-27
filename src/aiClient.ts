import * as vscode from "vscode";

export interface AiSuggestionParams {
  ruleId: string;
  ruleDescription: string;
  wcagRef: string;
  codeSnippet: string;
  languageId: string;
}

export async function getAiSuggestion(
  params: AiSuggestionParams
): Promise<string> {
  const config = vscode.workspace.getConfiguration();
  const apiKey = config.get<string>("wcag-ai-helper.apiKey");

  if (!apiKey) {
    throw new Error(
      "No API key configured. Set 'wcag-ai-helper.apiKey' in VS Code settings."
    );
  }

  const prompt = buildPrompt(params);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that edits source code to fix accessibility issues according to WCAG 2.2.\n\nYou are always given:\n- The language of the code snippet.\n- A rule ID, rule description, and WCAG reference.\n- A small code snippet that violates that rule.\n\nYour job:\n- Apply a minimal targeted fix to resolve the WCAG issue.\n- Preserve the original structure and framework (HTML stays HTML, JSX stays JSX).\n- Do not introduce unrelated changes.\n- Do not add comments, explanations, or Markdown.\n- Return ONLY the corrected code snippet.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `AI API request failed: ${response.status} ${response.statusText} - ${text}`
    );
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content ?? "";

  const fixedCode = content.trim();

  if (!fixedCode) {
    throw new Error("AI did not return any code.");
  }

  return fixedCode;
}

function buildPrompt(params: AiSuggestionParams): string {
  return `Language: ${params.languageId}

Rule:
- ID: ${params.ruleId}
- Description: ${params.ruleDescription}
- WCAG reference: ${params.wcagRef}

Task:
- Identify how this snippet violates the rule above.
- Fix ONLY that violation with the smallest possible change.
- Do not modify unaffected parts of the snippet.
- Do not introduce <script> tags or javascript: URLs.
- Do not add comments or explanations.
- Return ONLY the updated snippet, as plain code.

Original snippet:
${params.codeSnippet}`;
}
