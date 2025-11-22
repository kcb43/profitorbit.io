
import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Copy, Edit, Trash2, ListChecks, ListX, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function BulkActionsMenu() {
  const { toast } = useToast();

  const comingSoon = (label) =>
    toast({
      title: label,
      description: "This action will be available after marketplace integrations.",
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          Bulk Actions
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => comingSoon("Bulk Delist & Relist")}>
          <span>Bulk Delist &amp; Relist</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => comingSoon("Bulk Edit Labels")}>
          <Edit className="mr-2 h-4 w-4" />
          <span>Bulk Edit Vendoo Labels</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => comingSoon("Bulk Copy Items")}>
          <Copy className="mr-2 h-4 w-4" />
          <span>Bulk Copy Items</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => comingSoon("Bulk Delete")}>
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Bulk Delete</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => comingSoon("Bulk Delist")}>
          <ListX className="mr-2 h-4 w-4" />
          <span>Bulk Delist</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => comingSoon("Bulk Mark as Not Listed")}>
          <EyeOff className="mr-2 h-4 w-4" />
          <span>Bulk Mark as Not Listed</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => comingSoon("Bulk Edit")}>
          <Edit className="mr-2 h-4 w-4" />
          <span>Bulk Edit</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
