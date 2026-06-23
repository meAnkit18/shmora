# agent.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Principle:** Prefer correctness, simplicity, and minimal changes over speed.

---

## 1. Think Before Coding

Before implementing:

* State assumptions explicitly.
* Ask when requirements are unclear.
* Present multiple interpretations instead of choosing silently.
* Explain simpler alternatives when they exist.
* Push back on unnecessary complexity.

If something is unclear, stop and ask.

---

## 2. Simplicity First

Write the minimum code required to solve the problem.

* No features beyond the request.
* No speculative abstractions.
* No unnecessary configurability.
* No premature optimization.
* No handling of unrealistic scenarios.

If a solution can be 50 lines instead of 200, prefer 50.

---

## 3. Surgical Changes

Modify only what is required.

* No unrelated refactors.
* No unnecessary formatting changes.
* No improvements to adjacent code.
* Match existing project style.

You may remove imports, variables, or functions made unused by your own changes.

Every changed line should directly support the requested task.

---

## 4. Goal-Driven Execution

Convert requests into verifiable goals.

Example:

1. Reproduce issue → Verify reproduction.
2. Implement fix → Verify behavior.
3. Run tests/checks → Verify success.

Do not claim completion without verification.

---

## 5. Brainstorming Workflow

Follow this sequence:

Questions → Design Document → Implementation Plan → Implementation

During implementation:

* Always choose **Inline Implementation**.
* Never choose **Subagents**.

If asked whether to provide mockup HTML, preview pages, or open a new tab, always answer:

> No

---

## 6. Investigation & Impact Analysis

For understanding an issue:

> Strictly do not make any code changes or database changes anywhere in the application for now. Just tell me in detail.

For evaluating a proposed change:

> Please tell me the impact of these changes across the application. How much will it disturb? Strictly do not make any code changes or database changes anywhere in the application for now. Just tell me in detail.

In both modes:

* Diagnose.
* Explain.
* Analyze dependencies, risks, and affected areas.
* Do not implement anything.

---

## 7. Stability Requirements

For development tasks:

> Strictly no other change anywhere else in the application, nothing should break. Everything should work consistently and strictly no fallback mechanisms anywhere.

Requirements:

* No unrelated changes.
* No hidden behavior changes.
* No fallback mechanisms.
* Existing functionality must remain intact.

---

## 8. Default Rules

* Ask before assuming.
* Keep solutions simple.
* Prefer minimal diffs.
* Avoid speculative architecture.
* Avoid unnecessary abstractions.
* Avoid unrelated refactors.
* Verify before declaring success.

Success looks like:

* Smaller diffs.
* Fewer rewrites.
* More clarification before coding.
* Stable, focused implementations.
