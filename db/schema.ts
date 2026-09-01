import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scheduleRides = sqliteTable("schedule_rides", {
  id: text("id").primaryKey(),
  bus: integer("bus").notNull(),
  slot: text("slot").notNull(),
  day: text("day").notNull(),
  time: text("time").notNull(),
  stop: text("stop").notNull(),
  student: text("student").notNull(),
  englishName: text("english_name"),
  groupName: text("group_name").notNull().default("미분류"),
  sourceSheet: text("source_sheet"),
  sourceRow: integer("source_row"),
  updatedAt: text("updated_at").notNull(),
});

export const shuttleChanges = sqliteTable("shuttle_changes", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  student: text("student").notNull(),
  groupName: text("group_name").notNull().default("미분류"),
  type: text("type").notNull(),
  detail: text("detail").notNull(),
  source: text("source").notNull(),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull(),
  confirmedBy: text("confirmed_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
});
