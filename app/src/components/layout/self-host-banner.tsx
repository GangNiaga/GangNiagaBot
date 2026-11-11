import { IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import {
  dismissSelfHostBannerMutationOptions,
  useUserPreferences,
} from "@/lib/settings/message-list";
import { BUSINESS_URL } from "@/lib/openbot-for-business";

/**
 * A slim bar offering help self-hosting OpenBot, until this person closes it.
 *
 * Hidden until both answers are in, so it never flashes on and then off: the deployment has to say
 * the banner is on (a fork running OpenBot for its own people turns it off), and this person's
 * preferences have to say they have not closed it.
 */
export function SelfHostBanner() {
  const { data: capabilities } = useQuery(deploymentCapabilitiesQueryOptions());
  const { userId, data: preferences } = useUserPreferences();
  const queryClient = useQueryClient();
  const dismissMutation = useMutation(
    dismissSelfHostBannerMutationOptions(queryClient, userId),
  );

  if (!capabilities?.selfHostBanner || preferences?.selfHostBannerDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Self-host OpenBot"
      className="relative flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-sm"
    >
      <span>Self-host OpenBot for your organization.</span>
      <div className="flex items-center gap-2">
        <a
          href={BUSINESS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "link", size: "sm" })}
        >
          Book a call
        </a>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={() => dismissMutation.mutate()}
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
