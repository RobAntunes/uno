import { AppSidebar } from "../../components/ui/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb"
import { Separator } from "../../components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "../../components/ui/sidebar"

export default function Dashboard() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background text-foreground p-4">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white dark:bg-gray-950">
          <SidebarTrigger className="-ml-1 hover:bg-muted p-2 rounded-md" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">components</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">ui</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">button.tsx</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6 bg-gray-100 dark:bg-gray-900 rounded-lg shadow-inner">
          <div className="grid auto-rows-min gap-6 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-card border border-border p-4 flex items-center justify-center text-sm font-medium shadow-md hover:shadow-lg transition-shadow">
              Button Component
            </div>
            <div className="aspect-video rounded-xl bg-card border border-border p-4 flex items-center justify-center text-sm font-medium shadow-md hover:shadow-lg transition-shadow">
              API Reference
            </div>
            <div className="aspect-video rounded-xl bg-card border border-border p-4 flex items-center justify-center text-sm font-medium shadow-md hover:shadow-lg transition-shadow">
              Examples
            </div>
          </div>
          <div className="min-h-[60vh] flex-1 rounded-xl bg-card border border-border p-6 shadow-md">
            <h1 className="text-3xl font-bold mb-4 text-primary dark:text-primary-foreground">Button Component</h1>
            <div className="space-y-6">
              <p className="text-muted-foreground text-lg">
                Displays a button or a component that looks like a button.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                  Primary
                </button>
                <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors">
                  Secondary
                </button>
                <button className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors">
                  Destructive
                </button>
              </div>
              <h2 className="text-2xl font-semibold mt-8">Usage</h2>
              <pre className="bg-muted/50 dark:bg-muted/20 p-4 rounded-md overflow-x-auto border">
                <code className="text-sm text-foreground/80">
                  {`import { Button } from "@/components/ui/button"

export function Example() {
  return (
    <Button variant="default">Click me</Button>
  )
}`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 