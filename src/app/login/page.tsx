import { redirect } from "next/navigation";
import { getSession, ROLE_HOME } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/app/logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (session) redirect(ROLE_HOME[session.role]);
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[46%] flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo light />
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold leading-snug text-white">Dock appointments and gate control for Al Foah warehouse</h1>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">Customers raise shipment requests, carriers book a dock slot and receive a QR gate pass, and security verifies every truck at the gate. One record from request to gate out.</p>
          <dl className="mt-8 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-sidebar-muted">Docks</dt>
              <dd className="text-white">8 configurable</dd>
            </div>
            <div>
              <dt className="text-sidebar-muted">Operating hours</dt>
              <dd className="text-white">06:00 to 22:00</dd>
            </div>
            <div>
              <dt className="text-sidebar-muted">Gate</dt>
              <dd className="text-white">QR verified</dd>
            </div>
          </dl>
        </div>
        <div className="text-xs text-sidebar-muted">Agthia Group PJSC, Al Foah Warehouse, Al Ain</div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-lg font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select your role, then enter your email and password.</p>
          <div className="mt-5">
            <LoginForm next={next} />
          </div>
        </div>
      </div>
    </div>
  );
}
