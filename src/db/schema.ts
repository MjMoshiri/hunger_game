import { pgTable, integer, text, type AnyPgColumn } from "drizzle-orm/pg-core";

export const node = pgTable("node", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => node.id),
});
