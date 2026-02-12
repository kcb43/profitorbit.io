import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderPlus, Trash2, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/api/base44Client";

const GROUP_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
];

/**
 * GroupDialog - Create or edit item groups
 * 
 * @param {boolean} isOpen - Dialog open state
 * @param {function} onClose - Close handler
 * @param {string} groupType - Type of group ('inventory', 'sales', 'crosslist')
 * @param {string[]} selectedItemIds - Array of item IDs to add to group
 * @param {object} existingGroup - Group to edit (optional)
 * @param {function} onSuccess - Success callback
 */
export function GroupDialog({
  isOpen,
  onClose,
  groupType = 'inventory',
  selectedItemIds = [],
  existingGroup = null,
  onSuccess,
}) {
  const [groupName, setGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Populate form when editing existing group
  useEffect(() => {
    if (existingGroup) {
      setGroupName(existingGroup.group_name || '');
      setSelectedColor(existingGroup.color || 'blue');
    } else {
      setGroupName('');
      setSelectedColor('blue');
    }
  }, [existingGroup, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a group name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (existingGroup) {
        // Update existing group
        const response = await apiClient.put('/api/inventory/groups', {
          group_id: existingGroup.id,
          group_name: groupName.trim(),
          color: selectedColor,
          add_items: selectedItemIds, // Add any new items
        });

        if (response.success) {
          toast({
            title: "Group updated",
            description: `"${groupName}" has been updated successfully`,
          });
          
          if (onSuccess) onSuccess(existingGroup.id);
          onClose();
        }
      } else {
        // Create new group
        const response = await apiClient.post('/api/inventory/groups', {
          group_name: groupName.trim(),
          group_type: groupType,
          color: selectedColor,
          item_ids: selectedItemIds,
        });

        if (response.success) {
          toast({
            title: "Group created",
            description: `"${groupName}" created with ${selectedItemIds.length} item${selectedItemIds.length !== 1 ? 's' : ''}`,
          });
          
          if (onSuccess) onSuccess(response.group.id);
          onClose();
        }
      }
    } catch (error) {
      console.error('Error saving group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save group",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            {existingGroup ? 'Edit Group' : 'Create New Group'}
          </DialogTitle>
          <DialogDescription>
            {existingGroup 
              ? `Update the name and color for "${existingGroup.group_name}"`
              : `Create a group${selectedItemIds.length > 0 ? ` with ${selectedItemIds.length} selected item${selectedItemIds.length !== 1 ? 's' : ''}` : ''}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Group Name */}
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., Winter Collection, Clearance Items"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Color Selection */}
            <div className="space-y-2">
              <Label>Group Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`relative p-3 rounded-lg border-2 transition-all ${
                      selectedColor === color.value
                        ? 'border-foreground ring-2 ring-offset-2 ring-offset-background'
                        : 'border-transparent hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className={`w-full h-6 rounded ${color.class}`}></div>
                    {selectedColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          ✓
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Count */}
            {selectedItemIds.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {selectedItemIds.length} item{selectedItemIds.length !== 1 ? 's' : ''} will be added to this group
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {existingGroup ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  {existingGroup ? 'Update Group' : 'Create Group'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ManageGroupsDialog - View and manage all groups
 */
export function ManageGroupsDialog({
  isOpen,
  onClose,
  groupType = 'inventory',
  onEditGroup,
  onDeleteGroup,
}) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
    }
  }, [isOpen, groupType]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/api/inventory/groups?group_type=${groupType}`);
      if (response.success) {
        setGroups(response.groups || []);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Error",
        description: "Failed to load groups",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (groupId, groupName) => {
    if (!confirm(`Delete group "${groupName}"? Items will not be deleted, only ungrouped.`)) {
      return;
    }

    setDeletingGroupId(groupId);

    try {
      const response = await apiClient.delete('/api/inventory/groups', {
        group_id: groupId,
      });

      if (response.success) {
        toast({
          title: "Group deleted",
          description: `"${groupName}" has been deleted`,
        });
        
        setGroups(groups.filter(g => g.id !== groupId));
        if (onDeleteGroup) onDeleteGroup(groupId);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setDeletingGroupId(null);
    }
  };

  const getColorClass = (color) => {
    const colorObj = GROUP_COLORS.find(c => c.value === color);
    return colorObj ? colorObj.class : 'bg-blue-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Groups</DialogTitle>
          <DialogDescription>
            View and manage your {groupType} groups
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No groups yet</p>
              <p className="text-sm">Create a group by selecting items first</p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-4 h-4 rounded-full ${getColorClass(group.color)} flex-shrink-0`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{group.group_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.member_count || 0} item{group.member_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (onEditGroup) onEditGroup(group);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(group.id, group.group_name)}
                    disabled={deletingGroupId === group.id}
                  >
                    {deletingGroupId === group.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
