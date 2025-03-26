import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";
import authentication from "./customerServiceRetail/authentication";
import returns from "./customerServiceRetail/returns";
import sales from "./customerServiceRetail/sales";
import actionsAgent from "./actionsAgent/actionsAgent";
import simulatedHuman from "./customerServiceRetail/simulatedHuman";



// Configure downstream agents for each agent
authentication.downstreamAgents = [returns, sales, actionsAgent, simulatedHuman];
returns.downstreamAgents = [authentication, sales, actionsAgent, simulatedHuman];
sales.downstreamAgents = [authentication, returns, actionsAgent, simulatedHuman];
actionsAgent.downstreamAgents = [authentication, returns, sales, simulatedHuman];
simulatedHuman.downstreamAgents = [authentication, returns, sales, actionsAgent];

// Create agent sets
export const allAgentSets: Record<string, AgentConfig[]> = {
  default: injectTransferTools([authentication, returns, sales, simulatedHuman]),
  customerService: injectTransferTools([authentication, returns, sales, simulatedHuman]),
  actions: injectTransferTools([actionsAgent]), // Dedicated actions agent set
  all: injectTransferTools([authentication, returns, sales, actionsAgent, simulatedHuman])
};

export const defaultAgentSetKey = "default";

export default injectTransferTools([
  authentication,
  returns,
  sales,
  actionsAgent,
  simulatedHuman,
]);