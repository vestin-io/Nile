# Cursor Adapter

The Cursor adapter owns Cursor-specific live-state reads, apply behavior, and import behavior.

It must stay narrow:

- target one concrete Cursor runtime surface
- translate shared saved connections into Cursor-specific local state
- leave shared persistence and read models to core
