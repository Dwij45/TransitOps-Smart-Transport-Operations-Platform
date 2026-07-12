This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database Seeding & Administration

To bootstrap the application database with reference values, default settings, and a rich set of linked demonstration data, run the seeding script:

```bash
npm run db:seed
```

This script is fully idempotent and can be run repeatedly without duplicating records or causing database conflicts. It also automatically configures the application settings with a default depot ("Mumbai Central Depot").

### Creating the First Administrator

Since public signup is disabled for security, you must bootstrap the first administrator user from the CLI.

To create the administrator interactively:

```bash
npx tsx scripts/create-admin.ts
```

Alternatively, you can pass command-line arguments directly:

```bash
npx tsx scripts/create-admin.ts --name "Admin User" --email "admin@transitops.com" --password "YourSecurePassword123"
```

Once created, you can use these credentials to log into the application dashboard.

