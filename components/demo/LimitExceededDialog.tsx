'use client';

import { useEffect, useState } from 'react';
import { useUsage } from '@/lib/contexts/usage-context';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, Coins } from '@phosphor-icons/react';
import { formatCost } from '@/lib/usage';

const CONSOLE_URL = 'https://console.case.dev';

export function LimitExceededDialog() {
  const { isLimitExceeded, usage, checkResult, timeRemaining } = useUsage();
  const [open, setOpen] = useState(false);

  // Show dialog when limit is exceeded
  useEffect(() => {
    if (isLimitExceeded) {
      setOpen(true);
    }
  }, [isLimitExceeded]);

  const handleUpgrade = () => {
    window.open(CONSOLE_URL, '_blank');
  };

  if (!isLimitExceeded) {
    return null;
  }

  const reason = checkResult?.reason;
  const title = reason === 'session_expired'
    ? 'Demo Session Expired'
    : 'Demo Limit Reached';

  const description = reason === 'session_expired'
    ? 'Your demo session has expired. Sign up for a free account to continue using the redaction tool.'
    : `You've used ${formatCost(usage?.totalCostUsd || 0)} of your ${formatCost(checkResult?.limits.maxCostUsd || 5)} demo limit. Sign up to continue.`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Usage Summary */}
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <Coins size={16} className="text-muted-foreground" />
              <span>Usage</span>
            </div>
            <span className="font-medium">
              {formatCost(usage?.totalCostUsd || 0)} / {formatCost(checkResult?.limits.maxCostUsd || 5)}
            </span>
          </div>

          {reason !== 'session_expired' && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-muted-foreground" />
                <span>Resets in</span>
              </div>
              <span className="font-medium">{timeRemaining}</span>
            </div>
          )}
        </div>

        {/* Benefits */}
        <div className="text-sm text-muted-foreground space-y-1 pb-2">
          <p className="font-medium text-foreground">With a free account you get:</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Unlimited document processing</li>
            <li>Advanced AI detection features</li>
            <li>Export to PDF, DOCX, and TXT</li>
            <li>Team collaboration tools</li>
          </ul>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade}>
            Get Started Free
            <ArrowRight size={16} data-icon="inline-end" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
