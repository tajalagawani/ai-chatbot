2025-03-23 00:09:59 2025-03-22 23:09:59,284 - __main__ - INFO - Starting worker on port 5002
2025-03-23 00:09:59 2025-03-22 23:09:59,284 - __main__ - INFO - Artifact ID: 88da9a84-8291-48a0-b7c4-75aa934b48e1
2025-03-23 00:09:59 2025-03-22 23:09:59,288 - werkzeug - INFO - WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
2025-03-23 00:09:59  * Running on all addresses (0.0.0.0)
2025-03-23 00:09:59  * Running on http://127.0.0.1:5002
2025-03-23 00:09:59  * Running on http://172.20.0.4:5002
2025-03-23 00:09:59 2025-03-22 23:09:59,288 - werkzeug - INFO - Press CTRL+C to quit
2025-03-23 00:09:59  * Serving Flask app 'worker'
2025-03-23 00:09:59  * Debug mode: off
2025-03-23 00:10:02 2025-03-22 23:10:02,144 - __main__ - INFO - Queued execution 76255ca8-af49-4468-b7d7-d46ee8c9d2be
2025-03-23 00:10:02 2025-03-22 23:10:02,145 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:10:02] "POST /execute HTTP/1.1" 200 -
2025-03-23 00:10:02 2025-03-22 23:10:02,145 - __main__ - INFO - Starting execution 76255ca8-af49-4468-b7d7-d46ee8c9d2be
2025-03-23 00:10:02 2025-03-22 23:10:02,145 - __main__ - INFO - Execution 76255ca8-af49-4468-b7d7-d46ee8c9d2be: Node get_repo_info started
2025-03-23 00:10:02 2025-03-22 23:10:02,149 - act_executor - INFO - Created temporary file: /tmp/tmphaulhjo9.act
2025-03-23 00:10:02 2025-03-22 23:10:02,149 - act.execution_manager - INFO - Initializing ExecutionManager
2025-03-23 00:10:02 2025-03-22 23:10:02,149 - act.execution_manager - INFO - Loading workflow data
2025-03-23 00:10:02 2025-03-22 23:10:02,150 - act.execution_manager - INFO - Loading node executors
2025-03-23 00:10:02 2025-03-22 23:10:02,472 - act.nodes.base_node - INFO - Registered node type: example -> ExampleNode
2025-03-23 00:10:02 2025-03-22 23:10:02,472 - act.nodes.base_node - INFO - Registered alias: sample -> example
2025-03-23 00:10:02 2025-03-22 23:10:02,473 - act.nodes.OpenaiNode - ERROR - Error registering OpenAI node: No module named 'base_node'
2025-03-23 00:10:02 2025-03-22 23:10:02,478 - act.nodes.AggregateNode - WARNING - Could not register AggregateNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,536 - act.nodes.ClaudeNode - ERROR - Error registering Claude node: No module named 'base_node'
2025-03-23 00:10:02 2025-03-22 23:10:02,536 - act.nodes.ListNode - WARNING - Could not register ListNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,537 - act.nodes.FilterNode - WARNING - Could not register FilterNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,606 - act.nodes.RequestNode - WARNING - Could not register RequestNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,606 - act.nodes.StartNode - WARNING - Could not register StartNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,623 - act.nodes.SlackNode - WARNING - Could not register SlackNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,782 - act.nodes.Neo4jNode - WARNING - Could not register Neo4jNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,840 - act.nodes.DynamodbNode - WARNING - Could not register DynamoDBNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,840 - act.nodes.DataformatterNode - WARNING - Could not register DataformatterNode with registry - module not found
2025-03-23 00:10:02 2025-03-22 23:10:02,841 - act.nodes.GitHubNode - ERROR - Error registering GitHub node: No module named 'base_node'
2025-03-23 00:10:02 2025-03-22 23:10:02,841 - act.execution_manager - INFO - Scanning nodes directory: /usr/local/lib/python3.9/site-packages/act/nodes
2025-03-23 00:10:02 2025-03-22 23:10:02,842 - act.execution_manager - INFO - Found 17 potential node files: OpenaiNode, AggregateNode, SetNode, GitHubNode, RequestNode, test_openai_node, GitHubNodetest, DynamodbNode, ListNode, Neo4jNode, GenericNode, ClaudeNode, FilterNode, node_api, StartNode, DataformatterNode, SlackNode
2025-03-23 00:10:02 2025-03-22 23:10:02,842 - act.execution_manager - INFO - Found node class BaseNode in OpenaiNode, registering as Base
2025-03-23 00:10:02 2025-03-22 23:10:02,876 - act.execution_manager - INFO - Found node class OpenAINode in OpenaiNode, registering as openai
2025-03-23 00:10:02 2025-03-22 23:10:02,911 - act.execution_manager - INFO - Found node class AggregateNode in AggregateNode, registering as aggregate
2025-03-23 00:10:02 2025-03-22 23:10:02,911 - act.execution_manager - INFO - Found node class BaseNode in AggregateNode, registering as Base
2025-03-23 00:10:02 2025-03-22 23:10:02,912 - act.execution_manager - ERROR - Error processing node file SetNode: No module named 'base_node'
2025-03-23 00:10:02 2025-03-22 23:10:02,913 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:10:02   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:10:02     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:10:02   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:10:02     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:10:02   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:10:02   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:10:02   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:10:02   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:10:02   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:10:02   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:10:02   File "/usr/local/lib/python3.9/site-packages/act/nodes/SetNode.py", line 12, in <module>
2025-03-23 00:10:02     from base_node import (
2025-03-23 00:10:02 ModuleNotFoundError: No module named 'base_node'
2025-03-23 00:10:02 
2025-03-23 00:10:02 2025-03-22 23:10:02,913 - act.execution_manager - INFO - Found node class BaseNode in GitHubNode, registering as Base
2025-03-23 00:10:02 2025-03-22 23:10:02,948 - act.execution_manager - INFO - Found node class GitHubNode in GitHubNode, registering as github
2025-03-23 00:10:02 2025-03-22 23:10:02,948 - act.execution_manager - INFO - Found node class BaseNode in RequestNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,017 - act.execution_manager - INFO - Found node class RequestNode in RequestNode, registering as request
2025-03-23 00:10:03 2025-03-22 23:10:03,018 - act.execution_manager - ERROR - Error processing node file test_openai_node: No module named 'openai_node'
2025-03-23 00:10:03 2025-03-22 23:10:03,018 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:10:03     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:10:03     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:10:03   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/nodes/test_openai_node.py", line 13, in <module>
2025-03-23 00:10:03     from openai_node import OpenAINode, OpenAIOperation, OpenAIModelType
2025-03-23 00:10:03 ModuleNotFoundError: No module named 'openai_node'
2025-03-23 00:10:03 
2025-03-23 00:10:03 2025-03-22 23:10:03,018 - act.execution_manager - ERROR - Error processing node file GitHubNodetest: No module named 'GitHubNode'
2025-03-23 00:10:03 2025-03-22 23:10:03,019 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:10:03     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:10:03     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:10:03   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/nodes/GitHubNodetest.py", line 14, in <module>
2025-03-23 00:10:03     from GitHubNode import GitHubNode, GitHubOperation
2025-03-23 00:10:03 ModuleNotFoundError: No module named 'GitHubNode'
2025-03-23 00:10:03 
2025-03-23 00:10:03 2025-03-22 23:10:03,019 - act.execution_manager - INFO - Found node class BaseNode in DynamodbNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,052 - act.execution_manager - INFO - Found node class DynamoDBNode in DynamodbNode, registering as dynamodb
2025-03-23 00:10:03 2025-03-22 23:10:03,052 - act.execution_manager - INFO - Found node class BaseNode in ListNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,052 - act.execution_manager - INFO - Found node class ListNode in ListNode, registering as List
2025-03-23 00:10:03 2025-03-22 23:10:03,052 - act.execution_manager - INFO - Found node class BaseNode in Neo4jNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,085 - act.execution_manager - INFO - Found node class Neo4jNode in Neo4jNode, registering as neo4j
2025-03-23 00:10:03 2025-03-22 23:10:03,085 - act.execution_manager - INFO - Found node class GenericNode in GenericNode, registering as Generic
2025-03-23 00:10:03 2025-03-22 23:10:03,085 - act.execution_manager - INFO - Found node class BaseNode in ClaudeNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,119 - act.execution_manager - INFO - Found node class ClaudeNode in ClaudeNode, registering as claude
2025-03-23 00:10:03 2025-03-22 23:10:03,119 - act.execution_manager - INFO - Found node class BaseNode in FilterNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,119 - act.execution_manager - INFO - Found node class FilterNode in FilterNode, registering as Filter
2025-03-23 00:10:03 2025-03-22 23:10:03,123 - act.execution_manager - ERROR - Error processing node file node_api: [Errno 2] No such file or directory: '/Users/tajnoah/Desktop/langmvp/act_workflow/act/nodes'
2025-03-23 00:10:03 2025-03-22 23:10:03,123 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:10:03     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:10:03     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:10:03   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:10:03   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/nodes/node_api.py", line 249, in <module>
2025-03-23 00:10:03     load_node_modules()
2025-03-23 00:10:03   File "/usr/local/lib/python3.9/site-packages/act/nodes/node_api.py", line 49, in load_node_modules
2025-03-23 00:10:03     node_files = [f for f in os.listdir(nodes_dir) if f.endswith('Node.py')]
2025-03-23 00:10:03 FileNotFoundError: [Errno 2] No such file or directory: '/Users/tajnoah/Desktop/langmvp/act_workflow/act/nodes'
2025-03-23 00:10:03 
2025-03-23 00:10:03 2025-03-22 23:10:03,123 - act.execution_manager - INFO - Found node class BaseNode in StartNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,123 - act.execution_manager - INFO - Found node class StartNode in StartNode, registering as Start
2025-03-23 00:10:03 2025-03-22 23:10:03,124 - act.execution_manager - INFO - Found node class BaseNode in DataformatterNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,150 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:10:03] "GET /status/76255ca8-af49-4468-b7d7-d46ee8c9d2be HTTP/1.1" 200 -
2025-03-23 00:10:03 2025-03-22 23:10:03,152 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:10:03] "GET /status/76255ca8-af49-4468-b7d7-d46ee8c9d2be HTTP/1.1" 200 -
2025-03-23 00:10:03 2025-03-22 23:10:03,158 - act.execution_manager - INFO - Found node class DataformatterNode in DataformatterNode, registering as Dataformatter
2025-03-23 00:10:03 2025-03-22 23:10:03,158 - act.execution_manager - INFO - Found node class BaseNode in SlackNode, registering as Base
2025-03-23 00:10:03 2025-03-22 23:10:03,197 - act.execution_manager - INFO - Found node class SlackNode in SlackNode, registering as slack
2025-03-23 00:10:03 2025-03-22 23:10:03,198 - act.execution_manager - INFO - Discovered 14 node types: Base, openai, aggregate, github, request, dynamodb, List, neo4j, Generic, claude, Filter, Start, Dataformatter, slack
2025-03-23 00:10:03 2025-03-22 23:10:03,198 - act.execution_manager - INFO - Attempting to load node type: github
2025-03-23 00:10:03 2025-03-22 23:10:03,230 - act.execution_manager - INFO - Successfully loaded node executor for github
2025-03-23 00:10:03 
2025-03-23 00:10:03 Node Loading Status:
2025-03-23 00:10:03 +-------------+-----------+-----------------------------------------+
2025-03-23 00:10:03 | Node Type   | Status    | Message                                 |
2025-03-23 00:10:03 +=============+===========+=========================================+
2025-03-23 00:10:03 | github      | 🟢 SUCCESS | Loaded from discovered class GitHubNode |
2025-03-23 00:10:03 +-------------+-----------+-----------------------------------------+
2025-03-23 00:10:03 
2025-03-23 00:10:03 2025-03-22 23:10:03,231 - act.execution_manager - INFO - Starting execution of workflow with ID: exec_20250322231003
2025-03-23 00:10:03 2025-03-22 23:10:03,232 - act.execution_manager - INFO - Executing node: get_repo_info
2025-03-23 00:10:03 2025-03-22 23:10:03,232 - act.execution_manager - INFO - Node type: github
2025-03-23 00:10:03 2025-03-22 23:10:03,232 - act.execution_manager - INFO - Node data after resolving placeholders: {
2025-03-23 00:10:03   "id": "get_repo_info",
2025-03-23 00:10:03   "position_x": "100",
2025-03-23 00:10:03   "position_y": "100",
2025-03-23 00:10:03   "label": "Get Repo Info",
2025-03-23 00:10:03   "type": "github",
2025-03-23 00:10:03   "description": "Gets information about a GitHub repository",
2025-03-23 00:10:03   "operation": "get_repo",
2025-03-23 00:10:03   "auth_type": "token",
2025-03-23 00:10:03   "token": "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",
2025-03-23 00:10:03   "owner": "tajalagwani",
2025-03-23 00:10:03   "repo": "oslo3224"
2025-03-23 00:10:03 }
2025-03-23 00:10:03 2025-03-22 23:10:03,232 - act.execution_manager - INFO - Executor found for node type: github
2025-03-23 00:10:03 2025-03-22 23:10:03,554 - httpx - INFO - HTTP Request: GET https://api.github.com/repos/tajalagwani/oslo3224 "HTTP/1.1 404 Not Found"
2025-03-23 00:10:03 2025-03-22 23:10:03,555 - act.execution_manager - INFO - Node get_repo_info execution result: {
2025-03-23 00:10:03   "status": "error",
2025-03-23 00:10:03   "result": null,
2025-03-23 00:10:03   "error": "Not Found",
2025-03-23 00:10:03   "headers": {
2025-03-23 00:10:03     "date": "Sat, 22 Mar 2025 23:10:03 GMT",
2025-03-23 00:10:03     "content-type": "application/json; charset=utf-8",
2025-03-23 00:10:03     "x-oauth-scopes": "admin:enterprise, admin:gpg_key, admin:org, admin:org_hook, admin:public_key, admin:repo_hook, admin:ssh_signing_key, audit_log, codespace, copilot, delete:packages, delete_repo, gist, notifications, project, repo, user, workflow, write:discussion, write:network_configurations, write:packages",
2025-03-23 00:10:03     "x-accepted-oauth-scopes": "repo",
2025-03-23 00:10:03     "github-authentication-token-expiration": "2025-04-19 21:25:37 UTC",
2025-03-23 00:10:03     "x-github-media-type": "github.v3; format=json",
2025-03-23 00:10:03     "x-github-api-version-selected": "2022-11-28",
2025-03-23 00:10:03     "x-ratelimit-limit": "5000",
2025-03-23 00:10:03     "x-ratelimit-remaining": "4981",
2025-03-23 00:10:03     "x-ratelimit-reset": "1742685152",
2025-03-23 00:10:03     "x-ratelimit-used": "19",
2025-03-23 00:10:03     "x-ratelimit-resource": "core",
2025-03-23 00:10:03     "access-control-expose-headers": "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
2025-03-23 00:10:03     "access-control-allow-origin": "*",
2025-03-23 00:10:03     "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
2025-03-23 00:10:03     "x-frame-options": "deny",
2025-03-23 00:10:03     "x-content-type-options": "nosniff",
2025-03-23 00:10:03     "x-xss-protection": "0",
2025-03-23 00:10:03     "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
2025-03-23 00:10:03     "content-security-policy": "default-src 'none'",
2025-03-23 00:10:03     "vary": "Accept-Encoding, Accept, X-Requested-With",
2025-03-23 00:10:03     "content-encoding": "gzip",
2025-03-23 00:10:03     "transfer-encoding": "chunked",
2025-03-23 00:10:03     "server": "github.com",
2025-03-23 00:10:03     "x-github-request-id": "C9BE:C281D:12815BE:133BA65:67DF434B"
2025-03-23 00:10:03   },
2025-03-23 00:10:03   "rate_limit": {
2025-03-23 00:10:03     "limit": 5000,
2025-03-23 00:10:03     "remaining": 4981,
2025-03-23 00:10:03     "reset": 1742685152
2025-03-23 00:10:03   }
2025-03-23 00:10:03 }
2025-03-23 00:10:03 2025-03-22 23:10:03,556 - act.execution_manager - ERROR - Node get_repo_info execution failed. Stopping workflow.
2025-03-23 00:10:03 
2025-03-23 00:10:03 Node Execution Results:
2025-03-23 00:10:03 +---------------+----------+-----------+
2025-03-23 00:10:03 | Node Name     | Status   | Message   |
2025-03-23 00:10:03 +===============+==========+===========+
2025-03-23 00:10:03 | get_repo_info | 🔴 ERROR  |           |
2025-03-23 00:10:03 +---------------+----------+-----------+
2025-03-23 00:10:03 
2025-03-23 00:10:03 2025-03-22 23:10:03,557 - act_executor - INFO - Workflow execution completed successfully
2025-03-23 00:10:03 2025-03-22 23:10:03,559 - act_executor - INFO - Cleaned up temporary file: /tmp/tmphaulhjo9.act
2025-03-23 00:10:03 2025-03-22 23:10:03,559 - __main__ - INFO - Execution 76255ca8-af49-4468-b7d7-d46ee8c9d2be completed successfully
2025-03-23 00:10:04 2025-03-22 23:10:04,161 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:10:04] "GET /status/76255ca8-af49-4468-b7d7-d46ee8c9d2be HTTP/1.1" 200 -
