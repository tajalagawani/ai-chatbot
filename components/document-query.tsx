import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderIcon } from '@/components/icons';
import { toast } from 'sonner';

interface DocumentQueryProps {
  documentId: string;
  documentTitle: string;
}

export function DocumentQuery({ documentId, documentTitle }: DocumentQueryProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/documents/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId, question }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to query document');
      }
      
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      toast.error(err instanceof Error ? err.message : 'Failed to query document');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-6 w-full">
      <CardHeader>
        <CardTitle className="text-lg">Ask about this document</CardTitle>
        <CardDescription>
          Ask questions about "{documentTitle}" and get AI-powered answers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleQuerySubmit} className="flex flex-col space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="What would you like to know about this document?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !question.trim()}>
              {isLoading ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                'Ask'
              )}
            </Button>
          </div>
        </form>
        
        {answer && (
          <div className="mt-4 p-4 border rounded-md bg-secondary/20">
            <p className="text-sm font-semibold mb-1">Answer:</p>
            <p className="text-sm whitespace-pre-wrap">{answer}</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-4 border rounded-md bg-destructive/10 text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Answers are generated based on the document content only
      </CardFooter>
    </Card>
  );
}