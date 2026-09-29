"use client";

import type { ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { IconButton } from "./Button";

export type SortableRenderProps = {
  /** Drag handle plus accessible up/down buttons. */
  handle: ReactNode;
  index: number;
  isDragging: boolean;
};

type Props<T extends { id: string }> = {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, props: SortableRenderProps) => ReactNode;
  /** Accessible name of an item for the move buttons. */
  itemLabel: (item: T) => string;
  disabled?: boolean;
};

/**
 * Vertical list reorderable by drag (pointer or keyboard via the handle) and by
 * explicit up/down buttons as a non-drag fallback.
 */
export function SortableList<T extends { id: string }>({ items, onReorder, renderItem, itemLabel, disabled }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    onReorder(arrayMove(items, index, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Щоб перемістити, натисніть пробіл, стрілками оберіть місце, пробіл — підтвердити, Escape — скасувати.",
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              disabled={disabled}
              label={itemLabel(item)}
              first={index === 0}
              last={index === items.length - 1}
              onMove={(delta) => move(index, delta)}
            >
              {(handle, isDragging) => renderItem(item, { handle, index, isDragging })}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  disabled,
  label,
  first,
  last,
  onMove,
  children,
}: {
  id: string;
  disabled?: boolean;
  label: string;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  children: (handle: ReactNode, isDragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const handle = (
    <div className="flex shrink-0 items-center">
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Перетягнути: ${label}`}
        title="Перетягнути"
        disabled={disabled}
        className="flex size-7 cursor-grab items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg active:cursor-grabbing disabled:cursor-not-allowed"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="flex flex-col">
        <IconButton label={`Вище: ${label}`} size="sm" disabled={disabled || first} onClick={() => onMove(-1)} className="h-3.5! w-6!">
          <ArrowUp className="size-3" aria-hidden />
        </IconButton>
        <IconButton label={`Нижче: ${label}`} size="sm" disabled={disabled || last} onClick={() => onMove(1)} className="h-3.5! w-6!">
          <ArrowDown className="size-3" aria-hidden />
        </IconButton>
      </div>
    </div>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("relative", isDragging && "z-10 opacity-80")}
    >
      {children(handle, isDragging)}
    </li>
  );
}
