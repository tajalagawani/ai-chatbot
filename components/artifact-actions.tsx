import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { artifactDefinitions, UIArtifact } from './artifact';
import { Dispatch, memo, SetStateAction, useEffect, useState } from 'react';
import { ArtifactActionContext } from './create-artifact';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { dockerService } from '@/lib/services/docker';

interface ArtifactActionsProps {
 artifact: UIArtifact;
 handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
 currentVersionIndex: number;
 isCurrentVersion: boolean;
 mode: 'edit' | 'diff';
 metadata: any;
 setMetadata: Dispatch<SetStateAction<any>>;
}

function PureArtifactActions({
 artifact,
 handleVersionChange,
 currentVersionIndex,
 isCurrentVersion,
 mode,
 metadata,
 setMetadata,
}: ArtifactActionsProps) {
 const [isLoading, setIsLoading] = useState(false);

 // Initialize metadata with artifactId if not present
 useEffect(() => {
   const initMetadata = async () => {
     if (!metadata?.artifactId) {
       const isDockerHealthy = await dockerService.checkHealth();
       
       setMetadata((prev: any) => ({
         ...prev,
         artifactId: artifact.id,
         containerStatus: 'stopped',
         dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
         containerId: null,
         port: null,
         executionId: null,
         executionStatus: null,
         executionResult: null,
         outputs: [],
         lastError: null
       }));
     }
   };

   initMetadata();
 }, [artifact.id, metadata?.artifactId, setMetadata]);

 const artifactDefinition = artifactDefinitions.find(
   (definition) => definition.kind === artifact.kind,
 );

 if (!artifactDefinition) {
   throw new Error('Artifact definition not found!');
 }

 const actionContext: ArtifactActionContext = {
   content: artifact.content,
   handleVersionChange,
   currentVersionIndex,
   isCurrentVersion,
   mode,
   metadata: {
     ...metadata,
     artifactId: metadata?.artifactId || artifact.id
   },
   setMetadata,
 };

 return (
   <div className="flex flex-row gap-1">
     {artifactDefinition.actions.map((action) => (
       <Tooltip key={action.description}>
         <TooltipTrigger asChild>
           <Button
             variant="outline"
             className={cn('h-fit dark:hover:bg-zinc-700', {
               'p-2': !action.label,
               'py-1.5 px-2': action.label,
             })}
             onClick={async () => {
               setIsLoading(true);
               console.log('Starting action with context:', {
                 artifactId: actionContext.metadata.artifactId,
                 containerStatus: actionContext.metadata.containerStatus,
                 dockerStatus: actionContext.metadata.dockerStatus
               });

               try {
                 await Promise.resolve(action.onClick(actionContext));
               } catch (error) {
                 console.error('Action error:', error);
                 toast.error(error instanceof Error ? error.message : 'Failed to execute action');
               } finally {
                 setIsLoading(false);
               }
             }}
             disabled={
               isLoading || 
               artifact.status === 'streaming' ||
               (action.isDisabled ? action.isDisabled(actionContext) : false)
             }
           >
             {action.icon}
             {action.label}
           </Button>
         </TooltipTrigger>
         <TooltipContent>{action.description}</TooltipContent>
       </Tooltip>
     ))}
   </div>
 );
}

export const ArtifactActions = memo(
 PureArtifactActions,
 (prevProps, nextProps) => {
   if (prevProps.artifact.status !== nextProps.artifact.status) return false;
   if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) return false;
   if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
   if (prevProps.artifact.content !== nextProps.artifact.content) return false;
   if (prevProps.metadata?.artifactId !== nextProps.metadata?.artifactId) return false;
   if (prevProps.metadata?.containerStatus !== nextProps.metadata?.containerStatus) return false;

   return true;
 },
);

// Type definitions
interface UIArtifact {
 id: string;
 kind: string;
 content: string;
 status: 'idle' | 'streaming' | 'complete';
}

export type { ArtifactActionsProps, UIArtifact };
export default ArtifactActions;