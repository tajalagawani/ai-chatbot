2025-03-23 00:05:20 2025-03-22 23:05:20,093 - __main__ - INFO - Starting worker on port 5002
2025-03-23 00:05:20 2025-03-22 23:05:20,093 - __main__ - INFO - Artifact ID: 03394f08-d5da-4c41-b227-2d1ef7044488
2025-03-23 00:05:20 2025-03-22 23:05:20,096 - werkzeug - INFO - WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
2025-03-23 00:05:20  * Running on all addresses (0.0.0.0)
2025-03-23 00:05:20  * Running on http://127.0.0.1:5002
2025-03-23 00:05:20  * Running on http://172.20.0.4:5002
2025-03-23 00:05:20 2025-03-22 23:05:20,096 - werkzeug - INFO - Press CTRL+C to quit
2025-03-23 00:05:20  * Serving Flask app 'worker'
2025-03-23 00:05:20  * Debug mode: off
2025-03-23 00:05:22 2025-03-22 23:05:22,998 - __main__ - INFO - Queued execution 3ad3dc46-92dd-45d9-997a-9eda3813acd2
2025-03-23 00:05:23 2025-03-22 23:05:23,000 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:05:23] "POST /execute HTTP/1.1" 200 -
2025-03-23 00:05:23 2025-03-22 23:05:23,000 - __main__ - INFO - Starting execution 3ad3dc46-92dd-45d9-997a-9eda3813acd2
2025-03-23 00:05:23 2025-03-22 23:05:23,000 - __main__ - INFO - Execution 3ad3dc46-92dd-45d9-997a-9eda3813acd2: Node create_repository started
2025-03-23 00:05:23 2025-03-22 23:05:23,005 - act_executor - INFO - Created temporary file: /tmp/tmp8oh_mlh9.act
2025-03-23 00:05:23 2025-03-22 23:05:23,005 - act.execution_manager - INFO - Initializing ExecutionManager
2025-03-23 00:05:23 2025-03-22 23:05:23,005 - act.execution_manager - INFO - Loading workflow data
2025-03-23 00:05:23 2025-03-22 23:05:23,006 - act.execution_manager - INFO - Loading node executors
2025-03-23 00:05:23 2025-03-22 23:05:23,251 - act.nodes.base_node - INFO - Registered node type: example -> ExampleNode
2025-03-23 00:05:23 2025-03-22 23:05:23,251 - act.nodes.base_node - INFO - Registered alias: sample -> example
2025-03-23 00:05:23 2025-03-22 23:05:23,252 - act.nodes.OpenaiNode - ERROR - Error registering OpenAI node: No module named 'base_node'
2025-03-23 00:05:23 2025-03-22 23:05:23,256 - act.nodes.AggregateNode - WARNING - Could not register AggregateNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,305 - act.nodes.ClaudeNode - ERROR - Error registering Claude node: No module named 'base_node'
2025-03-23 00:05:23 2025-03-22 23:05:23,306 - act.nodes.ListNode - WARNING - Could not register ListNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,306 - act.nodes.FilterNode - WARNING - Could not register FilterNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,367 - act.nodes.RequestNode - WARNING - Could not register RequestNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,368 - act.nodes.StartNode - WARNING - Could not register StartNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,378 - act.nodes.SlackNode - WARNING - Could not register SlackNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,482 - act.nodes.Neo4jNode - WARNING - Could not register Neo4jNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,537 - act.nodes.DynamodbNode - WARNING - Could not register DynamoDBNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,537 - act.nodes.DataformatterNode - WARNING - Could not register DataformatterNode with registry - module not found
2025-03-23 00:05:23 2025-03-22 23:05:23,538 - act.nodes.GitHubNode - ERROR - Error registering GitHub node: No module named 'base_node'
2025-03-23 00:05:23 2025-03-22 23:05:23,538 - act.execution_manager - INFO - Scanning nodes directory: /usr/local/lib/python3.9/site-packages/act/nodes
2025-03-23 00:05:23 2025-03-22 23:05:23,539 - act.execution_manager - INFO - Found 17 potential node files: OpenaiNode, AggregateNode, SetNode, GitHubNode, RequestNode, test_openai_node, GitHubNodetest, DynamodbNode, ListNode, Neo4jNode, GenericNode, ClaudeNode, FilterNode, node_api, StartNode, DataformatterNode, SlackNode
2025-03-23 00:05:23 2025-03-22 23:05:23,539 - act.execution_manager - INFO - Found node class BaseNode in OpenaiNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,572 - act.execution_manager - INFO - Found node class OpenAINode in OpenaiNode, registering as openai
2025-03-23 00:05:23 2025-03-22 23:05:23,606 - act.execution_manager - INFO - Found node class AggregateNode in AggregateNode, registering as aggregate
2025-03-23 00:05:23 2025-03-22 23:05:23,606 - act.execution_manager - INFO - Found node class BaseNode in AggregateNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,607 - act.execution_manager - ERROR - Error processing node file SetNode: No module named 'base_node'
2025-03-23 00:05:23 2025-03-22 23:05:23,607 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:05:23     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:05:23     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/nodes/SetNode.py", line 12, in <module>
2025-03-23 00:05:23     from base_node import (
2025-03-23 00:05:23 ModuleNotFoundError: No module named 'base_node'
2025-03-23 00:05:23 
2025-03-23 00:05:23 2025-03-22 23:05:23,607 - act.execution_manager - INFO - Found node class BaseNode in GitHubNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,642 - act.execution_manager - INFO - Found node class GitHubNode in GitHubNode, registering as github
2025-03-23 00:05:23 2025-03-22 23:05:23,642 - act.execution_manager - INFO - Found node class BaseNode in RequestNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,710 - act.execution_manager - INFO - Found node class RequestNode in RequestNode, registering as request
2025-03-23 00:05:23 2025-03-22 23:05:23,711 - act.execution_manager - ERROR - Error processing node file test_openai_node: No module named 'openai_node'
2025-03-23 00:05:23 2025-03-22 23:05:23,711 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:05:23     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:05:23     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/nodes/test_openai_node.py", line 13, in <module>
2025-03-23 00:05:23     from openai_node import OpenAINode, OpenAIOperation, OpenAIModelType
2025-03-23 00:05:23 ModuleNotFoundError: No module named 'openai_node'
2025-03-23 00:05:23 
2025-03-23 00:05:23 2025-03-22 23:05:23,711 - act.execution_manager - ERROR - Error processing node file GitHubNodetest: No module named 'GitHubNode'
2025-03-23 00:05:23 2025-03-22 23:05:23,712 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:05:23     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:05:23     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/nodes/GitHubNodetest.py", line 14, in <module>
2025-03-23 00:05:23     from GitHubNode import GitHubNode, GitHubOperation
2025-03-23 00:05:23 ModuleNotFoundError: No module named 'GitHubNode'
2025-03-23 00:05:23 
2025-03-23 00:05:23 2025-03-22 23:05:23,712 - act.execution_manager - INFO - Found node class BaseNode in DynamodbNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,746 - act.execution_manager - INFO - Found node class DynamoDBNode in DynamodbNode, registering as dynamodb
2025-03-23 00:05:23 2025-03-22 23:05:23,746 - act.execution_manager - INFO - Found node class BaseNode in ListNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,746 - act.execution_manager - INFO - Found node class ListNode in ListNode, registering as List
2025-03-23 00:05:23 2025-03-22 23:05:23,746 - act.execution_manager - INFO - Found node class BaseNode in Neo4jNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,780 - act.execution_manager - INFO - Found node class Neo4jNode in Neo4jNode, registering as neo4j
2025-03-23 00:05:23 2025-03-22 23:05:23,780 - act.execution_manager - INFO - Found node class GenericNode in GenericNode, registering as Generic
2025-03-23 00:05:23 2025-03-22 23:05:23,780 - act.execution_manager - INFO - Found node class BaseNode in ClaudeNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,815 - act.execution_manager - INFO - Found node class ClaudeNode in ClaudeNode, registering as claude
2025-03-23 00:05:23 2025-03-22 23:05:23,815 - act.execution_manager - INFO - Found node class BaseNode in FilterNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,815 - act.execution_manager - INFO - Found node class FilterNode in FilterNode, registering as Filter
2025-03-23 00:05:23 2025-03-22 23:05:23,820 - act.execution_manager - ERROR - Error processing node file node_api: [Errno 2] No such file or directory: '/Users/tajnoah/Desktop/langmvp/act_workflow/act/nodes'
2025-03-23 00:05:23 2025-03-22 23:05:23,820 - act.execution_manager - ERROR - Traceback (most recent call last):
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/execution_manager.py", line 132, in discover_node_classes
2025-03-23 00:05:23     module = importlib.import_module(f".nodes.{module_name}", package="act")
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/importlib/__init__.py", line 127, in import_module
2025-03-23 00:05:23     return _bootstrap._gcd_import(name[level:], package, level)
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1030, in _gcd_import
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 1007, in _find_and_load
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 986, in _find_and_load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 680, in _load_unlocked
2025-03-23 00:05:23   File "<frozen importlib._bootstrap_external>", line 850, in exec_module
2025-03-23 00:05:23   File "<frozen importlib._bootstrap>", line 228, in _call_with_frames_removed
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/nodes/node_api.py", line 249, in <module>
2025-03-23 00:05:23     load_node_modules()
2025-03-23 00:05:23   File "/usr/local/lib/python3.9/site-packages/act/nodes/node_api.py", line 49, in load_node_modules
2025-03-23 00:05:23     node_files = [f for f in os.listdir(nodes_dir) if f.endswith('Node.py')]
2025-03-23 00:05:23 FileNotFoundError: [Errno 2] No such file or directory: '/Users/tajnoah/Desktop/langmvp/act_workflow/act/nodes'
2025-03-23 00:05:23 
2025-03-23 00:05:23 2025-03-22 23:05:23,820 - act.execution_manager - INFO - Found node class BaseNode in StartNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,820 - act.execution_manager - INFO - Found node class StartNode in StartNode, registering as Start
2025-03-23 00:05:23 2025-03-22 23:05:23,820 - act.execution_manager - INFO - Found node class BaseNode in DataformatterNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,855 - act.execution_manager - INFO - Found node class DataformatterNode in DataformatterNode, registering as Dataformatter
2025-03-23 00:05:23 2025-03-22 23:05:23,855 - act.execution_manager - INFO - Found node class BaseNode in SlackNode, registering as Base
2025-03-23 00:05:23 2025-03-22 23:05:23,889 - act.execution_manager - INFO - Found node class SlackNode in SlackNode, registering as slack
2025-03-23 00:05:23 2025-03-22 23:05:23,890 - act.execution_manager - INFO - Discovered 14 node types: Base, openai, aggregate, github, request, dynamodb, List, neo4j, Generic, claude, Filter, Start, Dataformatter, slack
2025-03-23 00:05:23 2025-03-22 23:05:23,890 - act.execution_manager - INFO - Attempting to load node type: github
2025-03-23 00:05:23 2025-03-22 23:05:23,924 - act.execution_manager - INFO - Successfully loaded node executor for github
2025-03-23 00:05:23 
2025-03-23 00:05:23 Node Loading Status:
2025-03-23 00:05:23 +-------------+-----------+-----------------------------------------+
2025-03-23 00:05:23 | Node Type   | Status    | Message                                 |
2025-03-23 00:05:23 +=============+===========+=========================================+
2025-03-23 00:05:23 | github      | 🟢 SUCCESS | Loaded from discovered class GitHubNode |
2025-03-23 00:05:23 +-------------+-----------+-----------------------------------------+
2025-03-23 00:05:23 
2025-03-23 00:05:23 2025-03-22 23:05:23,926 - act.execution_manager - INFO - Starting execution of workflow with ID: exec_20250322230523
2025-03-23 00:05:23 2025-03-22 23:05:23,926 - act.execution_manager - INFO - Executing node: create_repository
2025-03-23 00:05:23 2025-03-22 23:05:23,926 - act.execution_manager - INFO - Node type: github
2025-03-23 00:05:23 2025-03-22 23:05:23,926 - act.execution_manager - INFO - Node data after resolving placeholders: {
2025-03-23 00:05:23   "id": "create_repository",
2025-03-23 00:05:23   "position_x": "100",
2025-03-23 00:05:23   "position_y": "100",
2025-03-23 00:05:23   "label": "Create Repository",
2025-03-23 00:05:23   "type": "github",
2025-03-23 00:05:23   "description": "Creates a new GitHub repository",
2025-03-23 00:05:23   "operation": "create_repo",
2025-03-23 00:05:23   "auth_type": "token",
2025-03-23 00:05:23   "token": "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",
2025-03-23 00:05:23   "name": "oslo3224",
2025-03-23 00:05:23   "private": "false",
2025-03-23 00:05:23   "auto_init": "false"
2025-03-23 00:05:23 }
2025-03-23 00:05:23 2025-03-22 23:05:23,926 - act.execution_manager - INFO - Executor found for node type: github
2025-03-23 00:05:24 2025-03-22 23:05:24,010 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:05:24] "GET /status/3ad3dc46-92dd-45d9-997a-9eda3813acd2 HTTP/1.1" 200 -
2025-03-23 00:05:24 2025-03-22 23:05:24,011 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:05:24] "GET /status/3ad3dc46-92dd-45d9-997a-9eda3813acd2 HTTP/1.1" 200 -
2025-03-23 00:05:24 2025-03-22 23:05:24,305 - httpx - INFO - HTTP Request: POST https://api.github.com/user/repos "HTTP/1.1 422 Unprocessable Entity"
2025-03-23 00:05:24 2025-03-22 23:05:24,307 - act.execution_manager - INFO - Node create_repository execution result: {
2025-03-23 00:05:24   "status": "error",
2025-03-23 00:05:24   "result": null,
2025-03-23 00:05:24   "error": "Repository creation failed.",
2025-03-23 00:05:24   "headers": {
2025-03-23 00:05:24     "date": "Sat, 22 Mar 2025 23:05:24 GMT",
2025-03-23 00:05:24     "content-type": "application/json; charset=utf-8",
2025-03-23 00:05:24     "content-length": "282",
2025-03-23 00:05:24     "x-oauth-scopes": "admin:enterprise, admin:gpg_key, admin:org, admin:org_hook, admin:public_key, admin:repo_hook, admin:ssh_signing_key, audit_log, codespace, copilot, delete:packages, delete_repo, gist, notifications, project, repo, user, workflow, write:discussion, write:network_configurations, write:packages",
2025-03-23 00:05:24     "x-accepted-oauth-scopes": "public_repo, repo",
2025-03-23 00:05:24     "github-authentication-token-expiration": "2025-04-19 21:25:37 UTC",
2025-03-23 00:05:24     "x-github-media-type": "github.v3; format=json",
2025-03-23 00:05:24     "x-github-api-version-selected": "2022-11-28",
2025-03-23 00:05:24     "x-ratelimit-limit": "5000",
2025-03-23 00:05:24     "x-ratelimit-remaining": "4985",
2025-03-23 00:05:24     "x-ratelimit-reset": "1742685152",
2025-03-23 00:05:24     "x-ratelimit-used": "15",
2025-03-23 00:05:24     "x-ratelimit-resource": "core",
2025-03-23 00:05:24     "access-control-expose-headers": "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
2025-03-23 00:05:24     "access-control-allow-origin": "*",
2025-03-23 00:05:24     "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
2025-03-23 00:05:24     "x-frame-options": "deny",
2025-03-23 00:05:24     "x-content-type-options": "nosniff",
2025-03-23 00:05:24     "x-xss-protection": "0",
2025-03-23 00:05:24     "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
2025-03-23 00:05:24     "content-security-policy": "default-src 'none'",
2025-03-23 00:05:24     "vary": "Accept-Encoding, Accept, X-Requested-With",
2025-03-23 00:05:24     "server": "github.com",
2025-03-23 00:05:24     "x-github-request-id": "C77F:159D18:1266639:131F963:67DF4234"
2025-03-23 00:05:24   },
2025-03-23 00:05:24   "rate_limit": {
2025-03-23 00:05:24     "limit": 5000,
2025-03-23 00:05:24     "remaining": 4985,
2025-03-23 00:05:24     "reset": 1742685152
2025-03-23 00:05:24   }
2025-03-23 00:05:24 }
2025-03-23 00:05:24 2025-03-22 23:05:24,307 - act.execution_manager - ERROR - Node create_repository execution failed. Stopping workflow.
2025-03-23 00:05:24 
2025-03-23 00:05:24 Node Execution Results:
2025-03-23 00:05:24 +-------------------+----------+-----------+
2025-03-23 00:05:24 | Node Name         | Status   | Message   |
2025-03-23 00:05:24 +===================+==========+===========+
2025-03-23 00:05:24 | create_repository | 🔴 ERROR  |           |
2025-03-23 00:05:24 +-------------------+----------+-----------+
2025-03-23 00:05:24 
2025-03-23 00:05:24 2025-03-22 23:05:24,309 - act_executor - INFO - Workflow execution completed successfully
2025-03-23 00:05:24 2025-03-22 23:05:24,311 - act_executor - INFO - Cleaned up temporary file: /tmp/tmp8oh_mlh9.act
2025-03-23 00:05:24 2025-03-22 23:05:24,311 - __main__ - INFO - Execution 3ad3dc46-92dd-45d9-997a-9eda3813acd2 completed successfully
2025-03-23 00:05:25 2025-03-22 23:05:25,014 - werkzeug - INFO - 192.168.65.1 - - [22/Mar/2025 23:05:25] "GET /status/3ad3dc46-92dd-45d9-997a-9eda3813acd2 HTTP/1.1" 200 -
