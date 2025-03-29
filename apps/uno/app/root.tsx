import { AuthProvider } from "react-oidc-context";
import {
  Links,
  type LinksFunction,
  Meta,
  type MetaFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router-dom";

import "../styles.css";
import { AppNav } from "./app-nav";
import { Toaster } from "sonner";

export const meta: MetaFunction = () => [
  {
    title: "New Nx React Router App",
  },
];

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_s4bfK6epz",
  client_id: "qb0migspdlsa87cqar363sbdb",
  redirect_uri: "https://d84l1y8p4kdic.cloudfront.net",
  response_type: "code",
  scope: "email openid phone",
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider {...cognitoAuthConfig}>
      <html lang="en" className="h-screen overflow-hidden">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
        </head>
        <body className="h-full bg-background text-foreground">
          <AppNav />
          {children}
          <Toaster />
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    </AuthProvider>
  );
}

export default function App() {
  return <Outlet />;
}
