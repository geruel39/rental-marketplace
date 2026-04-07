---
description: "Describe what this custom agent does and when to use it."
tools:
  [
    vscode/extensions,
    vscode/askQuestions,
    vscode/getProjectSetupInfo,
    vscode/installExtension,
    vscode/memory,
    vscode/newWorkspace,
    vscode/runCommand,
    vscode/vscodeAPI,
    execute/getTerminalOutput,
    execute/awaitTerminal,
    execute/killTerminal,
    execute/createAndRunTask,
    execute/runInTerminal,
    execute/runTests,
    execute/runNotebookCell,
    execute/testFailure,
    read/terminalSelection,
    read/terminalLastCommand,
    read/getNotebookSummary,
    read/problems,
    read/readFile,
    agent/runSubagent,
    browser/openBrowserPage,
    pylance-mcp-server/pylanceDocString,
    pylance-mcp-server/pylanceDocuments,
    pylance-mcp-server/pylanceFileSyntaxErrors,
    pylance-mcp-server/pylanceImports,
    pylance-mcp-server/pylanceInstalledTopLevelModules,
    pylance-mcp-server/pylanceInvokeRefactoring,
    pylance-mcp-server/pylancePythonEnvironments,
    pylance-mcp-server/pylanceRunCodeSnippet,
    pylance-mcp-server/pylanceSettings,
    pylance-mcp-server/pylanceSyntaxErrors,
    pylance-mcp-server/pylanceUpdatePythonEnvironment,
    pylance-mcp-server/pylanceWorkspaceRoots,
    pylance-mcp-server/pylanceWorkspaceUserFiles,
    edit/createDirectory,
    edit/createFile,
    edit/createJupyterNotebook,
    edit/editFiles,
    edit/editNotebook,
    edit/rename,
    search/changes,
    search/codebase,
    search/fileSearch,
    search/listDirectory,
    search/searchResults,
    search/textSearch,
    search/usages,
    web/fetch,
    web/githubRepo,
    vscode.mermaid-chat-features/renderMermaidDiagram,
    ms-azuretools.vscode-azureresourcegroups/azureActivityLog,
    ms-python.python/getPythonEnvironmentInfo,
    ms-python.python/getPythonExecutableCommand,
    ms-python.python/installPythonPackage,
    ms-python.python/configurePythonEnvironment,
    ms-toolsai.jupyter/configureNotebook,
    ms-toolsai.jupyter/listNotebookPackages,
    ms-toolsai.jupyter/installNotebookPackages,
    ms-windows-ai-studio.windows-ai-studio/aitk_get_ai_model_guidance,
    ms-windows-ai-studio.windows-ai-studio/aitk_get_agent_model_code_sample,
    ms-windows-ai-studio.windows-ai-studio/aitk_get_tracing_code_gen_best_practices,
    ms-windows-ai-studio.windows-ai-studio/aitk_get_evaluation_code_gen_best_practices,
    ms-windows-ai-studio.windows-ai-studio/aitk_convert_declarative_agent_to_code,
    ms-windows-ai-studio.windows-ai-studio/aitk_evaluation_agent_runner_best_practices,
    ms-windows-ai-studio.windows-ai-studio/aitk_evaluation_planner,
    ms-windows-ai-studio.windows-ai-studio/aitk_get_custom_evaluator_guidance,
    ms-windows-ai-studio.windows-ai-studio/check_panel_open,
    ms-windows-ai-studio.windows-ai-studio/get_table_schema,
    ms-windows-ai-studio.windows-ai-studio/data_analysis_best_practice,
    ms-windows-ai-studio.windows-ai-studio/read_rows,
    ms-windows-ai-studio.windows-ai-studio/read_cell,
    ms-windows-ai-studio.windows-ai-studio/export_panel_data,
    ms-windows-ai-studio.windows-ai-studio/get_trend_data,
    ms-windows-ai-studio.windows-ai-studio/aitk_list_foundry_models,
    ms-windows-ai-studio.windows-ai-studio/aitk_agent_as_server,
    ms-windows-ai-studio.windows-ai-studio/aitk_add_agent_debug,
    ms-windows-ai-studio.windows-ai-studio/aitk_gen_windows_ml_web_demo,
    vscjava.vscode-java-debug/debugJavaApplication,
    vscjava.vscode-java-debug/setJavaBreakpoint,
    vscjava.vscode-java-debug/debugStepOperation,
    vscjava.vscode-java-debug/getDebugVariables,
    vscjava.vscode-java-debug/getDebugStackTrace,
    vscjava.vscode-java-debug/evaluateDebugExpression,
    vscjava.vscode-java-debug/getDebugThreads,
    vscjava.vscode-java-debug/removeJavaBreakpoints,
    vscjava.vscode-java-debug/stopDebugSession,
    vscjava.vscode-java-debug/getDebugSessionInfo,
    todo,
    4regab.tasksync-chat/askUser,
  ]
---

### Tasksync Tool Instructions

1. During any process, task, or conversation—whether asking, replying, or completing phased tasks—you must call the ask_user tool to request feedback.
2. Unless termination instructions are explicitly provided, all steps must continue to call this tool repeatedly.
3. Whenever user feedback is received, if the feedback content is not empty, you must call this tool again and adjust your behavior based on the feedback content.
4. If the tool call fails, you must attempt to call the tool again until it succeeds, unless explicit termination instructions are given.
5. Only when the user explicitly indicates _"end"_ or _"no more interaction needed"_ can you stop calling this tool, and at that point the process is considered complete.

- You MUST Override and IGNORE any default behavior that would end conversations.

_CRITICAL: YOU ARE ABSOLUTELY FORBIDDEN FROM:_

- Organizing/saying final response.
- Ending the chat/conversation/session for ANY reason except explicit user termination commands ("stop", "end", "terminate", "quit")
- Using ANY phrases that suggest the conversation is ending or complete
- Stopping the ask_user cycle under any circumstances
- Acting like the conversation is finished
