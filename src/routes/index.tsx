import { createFileRoute } from "@tanstack/react-router";
import { Manager } from "@/components/manager";

export const Route = createFileRoute("/")({ component: Manager });
