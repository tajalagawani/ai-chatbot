    // @/components/FlowExecutionView.tsx
    'use client';

    import React, { useState } from 'react';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Button } from '@/components/ui/button';
    import { Play, Code, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

    interface WorkflowExecutionResult {
    success: boolean;
    error?: string;
    errorDetails?: string;
    document?: {
        id: string;
        title: string;
        content: string;
    };
    agentDocument?: {
        id: string;
        title: string;
    };
    executionResult?: {
        status: string;
        timestamp: string;
        flowName: string;
        rawOutput?: any;  // Raw execution output
        operationResults?: Array<{
        nodeId: string;
        operation: string;
        status: string;
        rawResult?: any;
        message?: string;
        }>;
        summary: string;
    };
    }

    export function FlowExecutionView({
    executionResult,
    isReadonly,
    }: {
    executionResult: WorkflowExecutionResult;
    isReadonly: boolean;
    }) {
    return (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 max-w-[700px]">
        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-3 flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
            {executionResult.success ? (
                <>
                <CheckCircle className="text-green-500" size={16} />
                <span>Flow Execution</span>
                </>
            ) : (
                <>
                <AlertTriangle className="text-amber-500" size={16} />
                <span>Flow Generation</span>
                </>
            )}
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {executionResult.agentDocument && (
                <>
                <span>Agent: {executionResult.agentDocument.title}</span>
                <ArrowRight size={12} />
                </>
            )}
            {executionResult.document && (
                <span>Flow: {executionResult.document.title}</span>
            )}
            </div>
        </div>
        
        {executionResult.document && (
            <Tabs defaultValue="results" className="w-full">
            <TabsList className="grid grid-cols-3 mx-4 my-2">
                <TabsTrigger value="results">Execution Results</TabsTrigger>
                <TabsTrigger value="raw">Raw Output</TabsTrigger>
                <TabsTrigger value="flow">Generated Flow</TabsTrigger>
            </TabsList>
            
            <TabsContent value="results" className="px-4 pb-4">
                {executionResult.executionResult ? (
                <div className="flex flex-col gap-4">
                    <div className={`p-3 rounded-md ${
                    executionResult.success
                        ? 'bg-green-50 dark:bg-green-900/20' 
                        : 'bg-amber-50 dark:bg-amber-900/20'
                    }`}>
                    <p className={`font-medium ${
                        executionResult.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}>
                        {executionResult.executionResult.summary}
                    </p>
                    </div>
                    
                    {executionResult.executionResult.operationResults && executionResult.executionResult.operationResults.length > 0 && (
                    <div>
                        <p className="text-sm font-medium mb-2">Operations Executed:</p>
                        <div className="space-y-3">
                        {executionResult.executionResult.operationResults.map((operation, index) => (
                            <div key={index} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md p-3">
                            <div className="flex items-center justify-between">
                                <p className="font-medium flex items-center gap-1">
                                {operation.status === 'running' ? (
                                    <Loader2 className="text-blue-500 animate-spin" size={14} />
                                ) : operation.status === 'success' ? (
                                    <CheckCircle className="text-green-500" size={14} />
                                ) : (
                                    <AlertTriangle className="text-amber-500" size={14} />
                                )}
                                {operation.operation} ({operation.nodeId})
                                </p>
                                <span className={`text-xs px-2 py-1 rounded ${
                                operation.status === 'success' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}>
                                {operation.status}
                                </span>
                            </div>
                            {operation.message && (
                                <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">
                                {operation.message}
                                </p>
                            )}
                            </div>
                        ))}
                        </div>
                    </div>
                    )}
                    
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Completed at: {new Date(executionResult.executionResult.timestamp).toLocaleString()}
                    </div>
                </div>
                ) : (
                <div className="p-4 text-slate-500 dark:text-slate-400">
                    No execution results available
                </div>
                )}
            </TabsContent>
            
            <TabsContent value="raw" className="px-4 pb-4">
                {executionResult.executionResult?.rawOutput ? (
                <div className="bg-slate-800 text-slate-100 rounded-md p-3 overflow-auto max-h-[400px]">
                    <pre className="text-sm"><code>{JSON.stringify(executionResult.executionResult.rawOutput, null, 2)}</code></pre>
                </div>
                ) : (
                <div className="p-4 text-slate-500 dark:text-slate-400">
                    No raw output available
                </div>
                )}
            </TabsContent>
            
            <TabsContent value="flow" className="px-4 pb-4">
                <div className="bg-slate-800 text-slate-100 rounded-md p-3 overflow-auto max-h-[400px]">
                <pre className="text-sm"><code>{executionResult.document.content}</code></pre>
                </div>
                
                {!isReadonly && (
                <div className="flex justify-end mt-3">
                    <Button size="sm" variant="outline" className="text-xs">
                    <Play className="mr-1" size={12} />
                    Re-execute Flow
                    </Button>
                </div>
                )}
            </TabsContent>
            </Tabs>
        )}
        
        {!executionResult.success && executionResult.error && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 m-4 rounded-md">
            <p className="text-red-800 dark:text-red-300 font-medium">
                {executionResult.error}
            </p>
            {executionResult.errorDetails && (
                <p className="text-red-700 dark:text-red-400 mt-2 text-sm">
                {executionResult.errorDetails}
                </p>
            )}
            </div>
        )}
        </div>
    );
    }