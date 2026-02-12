-- Add item_links table for tracking duplicate relationships
CREATE TABLE IF NOT EXISTS public.item_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  linked_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'duplicate', -- 'duplicate', 'variant', etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(primary_item_id, linked_item_id)
);

-- Add item_groups table for user-created grouping system
CREATE TABLE IF NOT EXISTS public.item_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  group_type TEXT NOT NULL DEFAULT 'inventory', -- 'inventory', 'sales', 'crosslist'
  color TEXT, -- Optional color for the group badge
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add item_group_members junction table
CREATE TABLE IF NOT EXISTS public.item_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.item_groups(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, item_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_links_primary_item ON public.item_links(primary_item_id);
CREATE INDEX IF NOT EXISTS idx_item_links_linked_item ON public.item_links(linked_item_id);
CREATE INDEX IF NOT EXISTS idx_item_links_user ON public.item_links(user_id);
CREATE INDEX IF NOT EXISTS idx_item_groups_user ON public.item_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_item_group_members_group ON public.item_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_item_group_members_item ON public.item_group_members(item_id);

-- Enable RLS
ALTER TABLE public.item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for item_links
CREATE POLICY "Users can view their own item links"
  ON public.item_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own item links"
  ON public.item_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own item links"
  ON public.item_links FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for item_groups
CREATE POLICY "Users can view their own groups"
  ON public.item_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own groups"
  ON public.item_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups"
  ON public.item_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups"
  ON public.item_groups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for item_group_members
CREATE POLICY "Users can view their own group members"
  ON public.item_group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.item_groups
    WHERE item_groups.id = item_group_members.group_id
    AND item_groups.user_id = auth.uid()
  ));

CREATE POLICY "Users can add items to their own groups"
  ON public.item_group_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.item_groups
    WHERE item_groups.id = item_group_members.group_id
    AND item_groups.user_id = auth.uid()
  ));

CREATE POLICY "Users can remove items from their own groups"
  ON public.item_group_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.item_groups
    WHERE item_groups.id = item_group_members.group_id
    AND item_groups.user_id = auth.uid()
  ));

-- Add trigger for updated_at on item_groups
CREATE OR REPLACE FUNCTION update_item_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_item_groups_updated_at
  BEFORE UPDATE ON public.item_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_item_groups_updated_at();
