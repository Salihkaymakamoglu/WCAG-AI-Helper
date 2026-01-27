import type { TextDocument } from "vscode";
import { RULES } from "./rules";

export interface A11yIssue {
  ruleId: string;
  message: string;
  wcagRef: string;
  line: number;
  column: number;
}

export function analyzeDocument(doc: TextDocument): A11yIssue[] {
  const text = doc.getText();
  const lines = text.split(/\r?\n/);

  const issues: A11yIssue[] = [];
  function hasNearbyLabel(lines: string[], index: number): boolean {
    for (let i = index - 1; i >= 0 && index - i <= 2; i--) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      if (/<label\b/i.test(line)) return true;
      break;
    }
    return false;
  }
  // ----- R1: <img> without meaningful alt (decorative images allowed) -----
  const imgRule = RULES.find((r) => r.id === "R1_IMG_ALT") ?? {
    id: "R1_IMG_ALT",
    description: "Images must have non-empty, meaningful alt text.",
    wcagRef: "WCAG 2.2 - 1.1.1 Non-text Content",
  };

  const imgTagRegex = /<img\b[^>]*>/g;
  const altAttrRegex = /\balt\s*=\s*(['"])(.*?)\1/;

  lines.forEach((lineText, lineIndex) => {
    let match: RegExpExecArray | null;
    while ((match = imgTagRegex.exec(lineText)) !== null) {
      const imgTag = match[0];

      const hasAlt = altAttrRegex.test(imgTag);
      const altValueMatch = imgTag.match(altAttrRegex);
      const altValue = altValueMatch?.[2]?.trim();

      const isAriaHidden = /\baria-hidden\s*=\s*["']true["']/i.test(imgTag);
      const isPresentationalRole = /\brole\s*=\s*["']presentation["']/i.test(
        imgTag
      );
      const isDecorative = isAriaHidden || isPresentationalRole;

      // Decorative images are allowed to have alt=""
      if (!hasAlt && !isDecorative) {
        issues.push({
          ruleId: imgRule.id,
          message: imgRule.description,
          wcagRef: imgRule.wcagRef,
          line: lineIndex,
          column: match.index,
        });
      } else if (hasAlt && !altValue && !isDecorative) {
        // alt="" or whitespace on non-decorative image
        issues.push({
          ruleId: imgRule.id,
          message: imgRule.description,
          wcagRef: imgRule.wcagRef,
          line: lineIndex,
          column: match.index,
        });
      }
    }
  });

  // ----- R2: form controls without accessible name (labels + ARIA + placeholder/title) -----
  const labelRule = RULES.find((r) => r.id === "R2_LABEL") ?? {
    id: "R2_LABEL",
    description:
      "Form controls must have an accessible name (via <label>, aria-label, aria-labelledby, placeholder, or title).",
    wcagRef: "WCAG 2.2 - 3.3.2, 4.1.2",
  };

  // collect label associations and form controls across the document
  const labelForIds = new Set<string>();
  const formControls: {
    line: number;
    column: number;
    tagName: string;
    attrs: string;
    id: string | null;
  }[] = [];

  // scan for <label for="..."> and form controls
  lines.forEach((lineText, lineIndex) => {
    // Collect labels with "for" attributes
    const labelRegex = /<label\b[^>]*for\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = labelRegex.exec(lineText)) !== null) {
      const forId = labelMatch[1].trim();
      if (forId) {
        labelForIds.add(forId);
      }
    }

    // Collect form controls: <input>, <textarea>, <select>
    const controlRegex = /<(input|textarea|select)\b([^>]*)>/gi;
    let controlMatch: RegExpExecArray | null;
    while ((controlMatch = controlRegex.exec(lineText)) !== null) {
      const tagName = controlMatch[1].toLowerCase();
      const attrs = controlMatch[2] ?? "";
      const idMatch = /id\s*=\s*["']([^"']+)["']/i.exec(attrs);
      const id = idMatch ? idMatch[1].trim() : null;

      formControls.push({
        line: lineIndex,
        column: controlMatch.index,
        tagName,
        attrs,
        id,
      });
    }
  });

  // flag controls that lack any accessible name
  formControls.forEach((ctrl) => {
    const attrs = ctrl.attrs;

    // Ignore hidden inputs
    const isHiddenInput =
      ctrl.tagName === "input" && /\btype\s*=\s*["']hidden["']/i.test(attrs);
    if (isHiddenInput) {
      return;
    }

    const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/i.test(attrs);
    const hasAriaLabelledBy = /\baria-labelledby\s*=\s*["'][^"']+["']/i.test(
      attrs
    );
    const hasAssociatedLabel =
      (ctrl.id !== null && labelForIds.has(ctrl.id)) ||
      hasNearbyLabel(lines, ctrl.line);

    const hasAccessibleName =
      hasAriaLabel || hasAriaLabelledBy || hasAssociatedLabel;

    if (!hasAccessibleName) {
      issues.push({
        ruleId: labelRule.id,
        message: labelRule.description,
        wcagRef: labelRule.wcagRef,
        line: ctrl.line,
        column: ctrl.column,
      });
    }
  });

  // ----- R3: <button> without visible text or accessible name -----
  const buttonRule = RULES.find((r) => r.id === "R3_BUTTON") ?? {
    id: "R3_BUTTON",
    description: "Buttons must have visible text or an accessible name.",
    wcagRef: "WCAG 2.2 - 4.1.2 Name, Role, Value",
  };

  const buttonTagRegex = /<button\b([^>]*)>(.*?)<\/button>/gi;

  lines.forEach((lineText, lineIndex) => {
    let match: RegExpExecArray | null;
    while ((match = buttonTagRegex.exec(lineText)) !== null) {
      const attrs = match[1] ?? "";
      const innerContent = match[2]?.trim() ?? "";
      const hasTextContent = innerContent.length > 0;

      const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/i.test(attrs);
      const hasAriaLabelledBy = /\baria-labelledby\s*=\s*["'][^"']+["']/i.test(
        attrs
      );
      const hasTitle = /\btitle\s*=\s*["'][^"']+["']/i.test(attrs);

      const hasAccessibleName =
        hasTextContent || hasAriaLabel || hasAriaLabelledBy || hasTitle;

      if (!hasAccessibleName) {
        issues.push({
          ruleId: buttonRule.id,
          message: buttonRule.description,
          wcagRef: buttonRule.wcagRef,
          line: lineIndex,
          column: match.index,
        });
      }
    }
  });

  // ----- R4: <a> with non-descriptive or empty link text -----
  const linkRule = RULES.find((r) => r.id === "R4_LINK") ?? {
    id: "R4_LINK",
    description:
      'Links should have descriptive text, not just "click here" or similar.',
    wcagRef: "WCAG 2.2 - 2.4.4 Link Purpose (In Context)",
  };

  const linkTagRegex = /<a\b[^>]*>(.*?)<\/a>/gi;
  const badTexts = [
    "click here",
    "click",
    "here",
    "more",
    "read more",
    "learn more",
    "more info",
  ];

  lines.forEach((lineText, lineIndex) => {
    let match: RegExpExecArray | null;
    while ((match = linkTagRegex.exec(lineText)) !== null) {
      const innerHtml = match[1] ?? "";
      const innerText = innerHtml.replace(/<[^>]+>/g, "").trim(); 
      const lower = innerText.toLowerCase();

      const isEmpty = innerText.length === 0;
      const isGeneric = badTexts.includes(lower);
      const isUrl = /^https?:\/\//i.test(innerText);
      const isTooShort = innerText.length > 0 && innerText.length <= 2;

      if (isEmpty || isGeneric || isUrl || isTooShort) {
        issues.push({
          ruleId: linkRule.id,
          message: linkRule.description,
          wcagRef: linkRule.wcagRef,
          line: lineIndex,
          column: match.index,
        });
      }
    }
  });

  // ----- R5: document should have exactly one <h1> -----
  const h1Rule = RULES.find((r) => r.id === "R5_H1") ?? {
    id: "R5_H1",
    description: "Each document should contain exactly one <h1> element.",
    wcagRef: "WCAG 2.2 - 1.3.1 Info and Relationships",
  };

  let h1Count = 0;
  const h1Locations: { line: number; column: number }[] = [];
  const h1TagRegex = /<h1\b[^>]*>/g;

  lines.forEach((lineText, lineIndex) => {
    let match: RegExpExecArray | null;
    while ((match = h1TagRegex.exec(lineText)) !== null) {
      h1Count++;
      h1Locations.push({ line: lineIndex, column: match.index });
    }
  });

  if (h1Count === 0) {
    issues.push({
      ruleId: h1Rule.id,
      message: `${h1Rule.description} (Found none.)`,
      wcagRef: h1Rule.wcagRef,
      line: 0,
      column: 0,
    });
  } else if (h1Count > 1) {
    // Flag all additional <h1> elements after the first
    h1Locations.slice(1).forEach((loc) => {
      issues.push({
        ruleId: h1Rule.id,
        message: `${h1Rule.description} (Found ${h1Count} <h1> elements.)`,
        wcagRef: h1Rule.wcagRef,
        line: loc.line,
        column: loc.column,
      });
    });
  }

  // ----- R6: positive tabindex values -----
  const tabindexRule = RULES.find((r) => r.id === "R6_TABINDEX") ?? {
    id: "R6_TABINDEX",
    description: "Avoid positive tabindex values; rely on natural focus order.",
    wcagRef: "WCAG 2.2 - 2.4.3 Focus Order",
  };

  const tabindexRegex = /\btabindex\s*=\s*["'](\d+)["']/gi;

  lines.forEach((lineText, lineIndex) => {
    let match: RegExpExecArray | null;
    while ((match = tabindexRegex.exec(lineText)) !== null) {
      const value = parseInt(match[1], 10);
      if (value > 0) {
        issues.push({
          ruleId: tabindexRule.id,
          message: tabindexRule.description,
          wcagRef: tabindexRule.wcagRef,
          line: lineIndex,
          column: match.index,
        });
      }
    }
  });

  // ----- R7: role="button" without keyboard support -----
  const roleButtonRule = RULES.find((r) => r.id === "R7_ROLE_BUTTON") ?? {
    id: "R7_ROLE_BUTTON",
    description: 'Elements with role="button" must be keyboard operable.',
    wcagRef: "WCAG 2.2 - 2.1.1 Keyboard; 4.1.2",
  };

  const roleButtonRegex =
    /<([a-zA-Z0-9]+)\b[^>]*role\s*=\s*["']button["'][^>]*>/gis;

  let match: RegExpExecArray | null;
  while ((match = roleButtonRegex.exec(text)) !== null) {
    const tagName = match[1].toLowerCase();
    const tag = match[0];


    if (tagName === "button") continue;

    const hasTabindex = /\btabindex\s*=\s*["']0["']/i.test(tag);
    const hasKeyboardHandler = /\bonkey(down|up|press)\s*=/i.test(tag);
    const hasOnClick = /\bonclick\s*=/i.test(tag);

    // Flag ONLY click-only, non-keyboard-accessible buttons
    if (hasOnClick && (!hasTabindex || !hasKeyboardHandler)) {
      const before = text.slice(0, match.index);
      const line = before.split(/\r?\n/).length - 1;
      const column =
        before.lastIndexOf("\n") === -1
          ? match.index
          : match.index - before.lastIndexOf("\n") - 1;

      issues.push({
        ruleId: roleButtonRule.id,
        message: roleButtonRule.description,
        wcagRef: roleButtonRule.wcagRef,
        line,
        column,
      });
    }
  }

  return issues;
}
