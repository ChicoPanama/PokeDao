module.exports = {
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        {
          name: ".prisma/client",
          message: "Import from @prisma/client only — never from .prisma/*."
        }
      ],
      patterns: ["**/.prisma/**"]
    }]
  }
};
