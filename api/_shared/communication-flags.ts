export type CommunicationFeatureFlags = {
  moduleEnabled: boolean;
  publicationEnabled: boolean;
  sendingEnabled: boolean;
};

type CommunicationEnvironment = Partial<Record<
  "COMMUNICATIONS_ENABLED" | "COMMUNICATION_PUBLICATION_ENABLED" | "COMMUNICATION_SEND_ENABLED",
  string
>>;

function enabled(value: string | undefined): boolean {
  return value === "true";
}

export function readCommunicationFeatureFlags(
  env: CommunicationEnvironment = process.env
): CommunicationFeatureFlags {
  const moduleEnabled = enabled(env.COMMUNICATIONS_ENABLED);
  return {
    moduleEnabled,
    publicationEnabled: moduleEnabled && enabled(env.COMMUNICATION_PUBLICATION_ENABLED),
    sendingEnabled: moduleEnabled && enabled(env.COMMUNICATION_SEND_ENABLED),
  };
}
