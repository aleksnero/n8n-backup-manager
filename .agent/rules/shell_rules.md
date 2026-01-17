---
alwaysApply: true
---

# PowerShell Compatibility Rules

- **Environment**: Windows PowerShell 5.1
- **Restriction**: DO NOT use the `&&` or `||` operators for chaining commands, as they are not supported in this version.
- **Solution**: 
  - Run multiple commands as separate `run_command` calls.
  - If a logical sequence is required, use the following syntax:
    `command1; if ($?) { command2 }`
  - For simple separation where success doesn't matter, use `;`.

# Git Guidelines for this Shell
- Avoid one-liners like `git add . && git commit`.
- Prefer sequential execution to ensure clear output logs for each step.
