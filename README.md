# WCAG AI Helper

WCAG AI Helper is a developer-centric Visual Studio Code extension that provides real-time accessibility feedback aligned with WCAG 2.2 guidelines.
The tool combines rule-based static analysis with AI-assisted suggestions to help developers detect, understand, and fix accessibility issues during development.

## Features
	• Real-time accessibility issue detection while editing HTML files
	• WCAG 2.2–aligned rules (R1–R7) targeting high-impact issues
	• Developer-friendly diagnostics panel with clear messages
	• Optional AI-generated fix suggestions
	• Safe, controlled auto-fix workflow (manual confirmation required)

## Implemented WCAG Rules
The extension currently implements a selected subset of WCAG 2.2 rules suitable for static and interaction-aware analysis:

- R1_IMG_ALT: Images must have meaningful alternative text(WCAG 2.2 – 1.1.1)
- R2_LABEL: Form controls must have an accessible name(WCAG 2.2 – 3.3.2, 4.1.2)
- R3_BUTTON: Buttons must have visible text or an accessible name(WCAG 2.2 – 4.1.2)
- R4_LINK: Links must have descriptive text(WCAG 2.2 – 2.4.4)
- R5_H1: Document should contain exactly one <h1>(WCAG 2.2 – 1.3.1)
- R6_TABINDEX: Avoid positive tabindex values(WCAG 2.2 – 2.4.3)
- R7_ROLE_BUTTON: Custom buttons must be keyboard operable(WCAG 2.2 – 2.1.1)

## Installation and Configuration
1- Clone the repository
2- run npm install 
3- run npm compile
4- Start Debugging and select 'Extension Development Host'
5- For AI Usage setup API key from VS Code Settings under Wcag-ai-helper: Api Key
6- Go to the source code, press Ctrl+Shift+P / Cmd+Shift+P and select 'Scan current file for accessibility issues'
7- After the first run accessibilty issues should be visible under 'Problems,' and the WCAG-ai-helper will detect changes and re-run accessibility checks for that file if it's needed.

## License 
This project is developed for academic research purposes.

## Author
Salih Topel Kaymakamoğlu
