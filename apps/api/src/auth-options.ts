export const authOptions = {
  appName: "mmptici",
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: true, storage: "database" as const },
  advanced: {
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
};
