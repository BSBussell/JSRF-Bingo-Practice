import { Fragment, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

import { areaLabels, areaOrder, objectiveAreaOrder } from "../../data/areaMeta.js";
import { objectivesByArea, objectivesById } from "../../data/objectives.js";
import { areaDistrictToneClassName, districtToneClassName } from "../../lib/districtDisplay.js";
import { formatObjectiveTypeLabel } from "../../lib/objectiveTypes.js";
import { resolveSeedInput } from "../../lib/seed/sessionSeed.js";
import {
  buildSeedBuilderLaunchState,
  createSeedBuilderDraftFromSessionSpec,
  insertSeedBuilderObjective,
  moveSeedBuilderObjective,
  normalizeSeedBuilderDraft,
  normalizeSeedBuilderDraftAfterObjectiveChange,
  removeSeedBuilderObjective
} from "../../lib/seedBuilder.js";
import {
  ROUTE_REVEAL_MODE_BURST,
  ROUTE_REVEAL_MODE_LABELS,
  ROUTE_REVEAL_MODE_ROLLING
} from "../../lib/session/routeRevealMode.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../../lib/session/sessionTypes.js";
import {
  ROUTE_VISIBLE_COUNT_MAX,
  ROUTE_VISIBLE_COUNT_MIN
} from "../../lib/drill/drillSettings.js";
import { SegmentedChoice } from "../session/SegmentedChoice.jsx";
import { BoundedNumberInput } from "../shared/BoundedNumberInput.jsx";

const TIMELINE_CONTAINER_ID = "seed-builder-timeline";
const TIMELINE_END_ID = "seed-builder-timeline-end";

function timelineDragId(objectiveId) {
  return `timeline:${objectiveId}`;
}

function routeDragId(objectiveId) {
  return `route:${objectiveId}`;
}

function pickerDragId(objectiveId) {
  return `picker:${objectiveId}`;
}

// Drag targets are derived from stable ids, then resolved back into the current
// objective order at drop time. That keeps reordering tied to source-of-truth
// state instead of stale render-time indices captured when the drag started.
function parseObjectiveDragId(id, prefix) {
  if (typeof id !== "string" || !id.startsWith(prefix)) {
    return null;
  }

  const objectiveId = id.slice(prefix.length);
  return objectiveId || null;
}

function parseTimelineObjectiveId(id) {
  return parseObjectiveDragId(id, "timeline:");
}

function parseRouteObjectiveId(id) {
  return parseObjectiveDragId(id, "route:");
}

function parsePickerObjectiveId(id) {
  return parseObjectiveDragId(id, "picker:");
}

function findObjectiveIndex(objectiveIds, objectiveId) {
  if (typeof objectiveId !== "string") {
    return -1;
  }

  return objectiveIds.indexOf(objectiveId);
}

function resolvePickerTimelineInsertPreviewIndex(activeId, overId, objectiveIds) {
  if (!parsePickerObjectiveId(activeId)) {
    return -1;
  }

  const overTimelineObjectiveId = parseTimelineObjectiveId(overId);
  if (overTimelineObjectiveId) {
    return findObjectiveIndex(objectiveIds, overTimelineObjectiveId);
  }

  if (overId === TIMELINE_CONTAINER_ID || overId === TIMELINE_END_ID) {
    return objectiveIds.length;
  }

  return -1;
}

function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const nonContainerPointerCollisions = pointerCollisions.filter(
      (collision) => String(collision.id) !== TIMELINE_CONTAINER_ID
    );
    return nonContainerPointerCollisions.length > 0
      ? nonContainerPointerCollisions
      : pointerCollisions;
  }

  return rectIntersection(args);
}

function formatSeedBuilderTypeLabel(objective) {
  if (objective.type === "default") return "Default Soul";
  if (objective.type === "unlock") return "Unlock";
  if (objective.type === "graffiti") return "Graffiti";
  return formatObjectiveTypeLabel(objective.type);
}

function compactObjectiveLabel(objective) {
  const areaPrefix = `${objective.areaLabel ?? areaLabels[objective.area] ?? objective.area} - `;
  return objective.label?.startsWith(areaPrefix)
    ? objective.label.slice(areaPrefix.length)
    : objective.description ?? objective.label;
}

function chunkArray(items, size) {
  const safeSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
}

function pluralizeSquares(count) {
  return `${count} square${count === 1 ? "" : "s"}`;
}

function objectiveDragData(kind, objective) {
  return {
    kind,
    objectiveId: objective.id,
    label: compactObjectiveLabel(objective),
    areaLabel: objective.areaLabel ?? areaLabels[objective.area] ?? objective.area,
    district: objective.district,
    typeLabel: formatSeedBuilderTypeLabel(objective)
  };
}

function SeedBuilderCardMeta({ objective, dragData = null }) {
  const district = objective?.district ?? dragData?.district;
  const areaLabel =
    objective?.areaLabel ??
    (objective?.area ? areaLabels[objective.area] : null) ??
    dragData?.areaLabel;
  const typeLabel = objective ? formatSeedBuilderTypeLabel(objective) : dragData?.typeLabel;

  return (
    <span className="seed-builder-card-meta">
      <span className={`seed-builder-level-label ${districtToneClassName(district)}`}>
        {areaLabel}
      </span>
      <span>{typeLabel}</span>
    </span>
  );
}

function SeedBuilderTilePreview({ dragData }) {
  if (!dragData) {
    return null;
  }

  return (
    <article
      className={`seed-builder-drag-preview ${districtToneClassName(dragData.district)} ${
        dragData.kind === "picker" ? "is-picker" : "is-timeline"
      }`}
    >
      <div className="seed-builder-card-copy">
        <strong>{dragData.label}</strong>
        <SeedBuilderCardMeta dragData={dragData} />
      </div>
    </article>
  );
}

function SeedBuilderTimelineInsertPreview({ dragData }) {
  if (!dragData) {
    return null;
  }

  return (
    <article
      className={`seed-builder-timeline-card seed-builder-timeline-insert-card ${districtToneClassName(dragData.district)}`}
      aria-hidden="true"
    >
      <span className="seed-builder-timeline-index">+</span>
      <div className="seed-builder-card-copy">
        <strong>{dragData.label}</strong>
        <SeedBuilderCardMeta dragData={dragData} />
      </div>
    </article>
  );
}

function TimelineTile({
  objective,
  index
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: timelineDragId(objective.id),
    data: objectiveDragData("timeline", objective)
  });
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      className={`seed-builder-timeline-card ${isDragging ? "is-dragging" : ""} ${districtToneClassName(objective.district)}`}
      ref={setNodeRef}
      data-timeline-drag-id={timelineDragId(objective.id)}
      style={style}
      {...attributes}
      {...listeners}
    >
      <span className="seed-builder-timeline-index">{index + 1}</span>
      <div className="seed-builder-card-copy">
        <strong>{compactObjectiveLabel(objective)}</strong>
        <SeedBuilderCardMeta objective={objective} />
      </div>
    </article>
  );
}

function PickerTile({
  objective,
  addLabel,
  dragDisabled,
  used,
  onAdd
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef
  } = useDraggable({
    id: pickerDragId(objective.id),
    data: objectiveDragData("picker", objective),
    disabled: used || dragDisabled
  });

  return (
    <article
      className={`seed-builder-shelf-card ${used ? "is-used" : ""} ${dragDisabled ? "is-drag-disabled" : ""} ${isDragging ? "is-dragging" : ""} ${districtToneClassName(objective.district)}`}
      ref={setNodeRef}
      aria-disabled={used}
      {...attributes}
      {...listeners}
    >
      <div className="seed-builder-card-copy">
        <strong>{compactObjectiveLabel(objective)}</strong>
        <SeedBuilderCardMeta objective={objective} />
      </div>
      {used ? (
        <span className="seed-builder-in-seed-status">✓ In seed</span>
      ) : (
        <button
          className="secondary-button seed-builder-add-button"
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={() => onAdd(objective.id)}
        >
          {addLabel}
        </button>
      )}
    </article>
  );
}

function SeedBuilderTimeline({
  previewDragData,
  previewIndex,
  objectives,
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: TIMELINE_CONTAINER_ID,
    data: {
      kind: "timeline-container"
    }
  });
  const { isOver: isOverEnd, setNodeRef: setEndNodeRef } = useDroppable({
    id: TIMELINE_END_ID,
    data: {
      kind: "timeline-end"
    }
  });
  const showEmptyState = objectives.length === 0;
  const hasInsertPreview = previewIndex >= 0 && Boolean(previewDragData);

  return (
    <section className="seed-builder-section seed-builder-preview-section" aria-label="Square order">
      <div className="seed-builder-section-heading">
        <div>
          
          <h2>Square Order</h2>
        </div>
        <span className="seed-builder-section-count">{pluralizeSquares(objectives.length)}</span>
      </div>
      
      <div
        className={`seed-builder-timeline ${showEmptyState ? "is-empty" : ""} ${isOver ? "is-over" : ""}`}
        ref={setNodeRef}
        aria-label="Seed timeline"
      >
        {showEmptyState ? (
          <div className="seed-builder-empty-timeline">
            <p className="eyebrow">Square order</p>
            <h2>Add squares from the pool</h2>
            <p>Pick a level below, then add squares in the order you want to play.</p>
          </div>
        ) : (
          <SortableContext
            items={objectives.map((objective) => timelineDragId(objective.id))}
            strategy={horizontalListSortingStrategy}
          >
            {hasInsertPreview && previewIndex === 0 ? (
              <SeedBuilderTimelineInsertPreview dragData={previewDragData} />
            ) : null}
            {objectives.map((objective, index) => (
              <Fragment key={objective.id}>
                <TimelineTile
                  objective={objective}
                  index={index}
                />
                {hasInsertPreview && previewIndex === index + 1 ? (
                  <SeedBuilderTimelineInsertPreview dragData={previewDragData} />
                ) : null}
              </Fragment>
            ))}
            <div
              className={`seed-builder-timeline-end-drop ${isOverEnd ? "is-over" : ""}`}
              ref={setEndNodeRef}
              aria-label="Drop here to append"
            />
          </SortableContext>
        )}
      </div>
    </section>
  );
}

function SeedBuilderPicker({
  activeDragKind,
  addLabel,
  dragDisabled = false,
  selectedArea,
  objectives,
  usedObjectiveIds,
  onSelectArea,
  onAdd
}) {
  const canRemoveByDrop = activeDragKind === "timeline";

  return (
    <section
      className={`seed-builder-picker ${canRemoveByDrop ? "is-remove-target" : ""}`}
      aria-label="Objective pool"
    >
      <div className="seed-builder-section-heading seed-builder-picker-heading">
        <div>
          <p className="eyebrow">Objective pool</p>
          <h2>Choose Squares</h2>
        </div>
      </div>
      <p className="seed-builder-picker-copy">
        Drag squares up into the order rail, or use the add buttons to queue them.
      </p>
      <div className="seed-builder-level-tabs" aria-label="Levels">
        {objectiveAreaOrder.map((area) => (
          <button
            key={area}
            className={`seed-builder-level-tab ${selectedArea === area ? "is-active" : ""} ${areaDistrictToneClassName(area)}`}
            type="button"
            onClick={() => onSelectArea(area)}
          >
            {areaLabels[area] ?? area}
          </button>
        ))}
      </div>
      {canRemoveByDrop ? (
        <p className="seed-builder-remove-hint">
          Release outside the timeline to remove this square.
        </p>
      ) : null}

      <div className="seed-builder-shelf" aria-label={`${areaLabels[selectedArea] ?? selectedArea} squares`}>
        {objectives.map((objective) => (
          <PickerTile
            key={objective.id}
            objective={objective}
            addLabel={addLabel}
            dragDisabled={dragDisabled}
            used={usedObjectiveIds.has(objective.id)}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  );
}

function SeedSetupSection({
  startingArea,
  seedFieldValue,
  sessionType,
  onImport,
  onStartingAreaChange,
  onSeedFieldChange,
  onSessionTypeChange
}) {
  return (
    <section className="seed-builder-seed-bar seed-builder-section" aria-label="Seed setup">
      <div className="seed-builder-section-heading">
        <div>
          <p className="eyebrow">Seed setup</p>
          <h2>Seed Setup</h2>
        </div>
      </div>
      <div className="seed-builder-seed-row">
        <label className="field seed-builder-seed-field">
          <span>Seed</span>
          <input
            type="text"
            value={seedFieldValue}
            placeholder="Paste seed or phrase, then import"
            onChange={(event) => onSeedFieldChange(event.target.value)}
          />
        </label>
        <button className="secondary-button" type="button" onClick={onImport}>
          Import
        </button>
        <SegmentedChoice
          label="Seed type"
          value={sessionType}
          options={[
            { value: PRACTICE_SESSION_TYPE, label: "Square" },
            { value: ROUTE_SESSION_TYPE, label: "Route" }
          ]}
          onChange={onSessionTypeChange}
        />
        <label className="field seed-builder-start-area-field">
          <span>Start</span>
          <select
            value={startingArea}
            onChange={(event) => onStartingAreaChange(event.target.value)}
          >
            {areaOrder.map((area) => (
              <option key={area} value={area}>
                {areaLabels[area] ?? area}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function RouteBehaviorSection({
  routeVisibleMax,
  routeVisibleCount,
  routeRevealMode,
  routeVisionTrainingEnabled,
  onRouteRevealModeChange,
  onRouteVisibleCountChange,
  onRouteVisionTrainingEnabledChange
}) {
  return (
    <section className="seed-builder-section seed-builder-route-behavior" aria-label="Route behavior">
      <div className="seed-builder-section-heading">
        <div>
          <p className="eyebrow">Route behavior</p>
          <h2>Route Behavior</h2>
        </div>
      </div>
      <div className="seed-builder-route-row">
        <label className="field seed-builder-visible-field">
          <span>Visible</span>
          <BoundedNumberInput
            min={ROUTE_VISIBLE_COUNT_MIN}
            max={routeVisibleMax}
            value={routeVisibleCount}
            step={1}
            commitOnChange
            normalizeValue={Math.round}
            onCommit={onRouteVisibleCountChange}
          />
        </label>
        <SegmentedChoice
          label="Reveal style"
          value={routeRevealMode}
          options={[
            {
              value: ROUTE_REVEAL_MODE_ROLLING,
              label: ROUTE_REVEAL_MODE_LABELS[ROUTE_REVEAL_MODE_ROLLING]
            },
            {
              value: ROUTE_REVEAL_MODE_BURST,
              label: ROUTE_REVEAL_MODE_LABELS[ROUTE_REVEAL_MODE_BURST]
            }
          ]}
          onChange={onRouteRevealModeChange}
        />
        <label className="setup-toggle-card setup-toggle-card-compact seed-builder-vision-toggle">
          <div className="settings-row-copy">
            <strong>Vision training</strong>
            <p>Use a blank 5x5 board and scatter the route squares along it.</p>
          </div>
          <span className="toggle-shell">
            <input
              type="checkbox"
              checked={routeVisionTrainingEnabled}
              onChange={(event) => onRouteVisionTrainingEnabledChange(event.target.checked)}
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}

function RouteGroupChip({
  objective,
  index
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: routeDragId(objective.id),
    data: objectiveDragData("route", objective)
  });
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      className={`seed-builder-route-chip ${isDragging ? "is-dragging" : ""} ${districtToneClassName(objective.district)}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <span className="seed-builder-timeline-index">{index + 1}</span>
      <div className="seed-builder-card-copy">
        <strong>{compactObjectiveLabel(objective)}</strong>
        <SeedBuilderCardMeta objective={objective} />
      </div>
    </article>
  );
}

function RouteVisibilityGroupsPreview({
  objectives,
  visibleCount
}) {
  const visibleGroups = chunkArray(objectives, visibleCount);

  return (
    <section className="seed-builder-section seed-builder-preview-section" aria-label="Route visibility groups">
      <div className="seed-builder-section-heading">
        <div>
          
          <h2>Route Visibility Groups</h2>
        </div>
        <span className="seed-builder-section-count">
          {pluralizeSquares(objectives.length)} · {visibleCount} visible · {visibleGroups.length} group{visibleGroups.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="seed-builder-section-copy">
        Groups are derived from the current square order and visible count.
      </p>
      {objectives.length === 0 ? (
        <div className="seed-builder-empty-route-preview">
          <p className="eyebrow">Route groups</p>
          <h2>Add squares from the pool</h2>
          <p>Route preview will group selected squares by the visible count.</p>
        </div>
      ) : (
        <SortableContext
          items={objectives.map((objective) => routeDragId(objective.id))}
          strategy={rectSortingStrategy}
        >
          <div className="seed-builder-route-groups">
            {visibleGroups.map((group, groupIndex) => {
              const startIndex = groupIndex * visibleCount;
              const endIndex = startIndex + group.length;
              return (
                <section className="seed-builder-route-group" key={`${groupIndex}-${startIndex}`}>
                  <h3>
                    Group {groupIndex + 1} · Squares {startIndex + 1}–{endIndex}
                  </h3>
                  <div className="seed-builder-route-group-grid">
                    {group.map((objective, groupObjectiveIndex) => {
                      const objectiveIndex = startIndex + groupObjectiveIndex;
                      return (
                        <RouteGroupChip
                          key={objective.id}
                          objective={objective}
                          index={objectiveIndex}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

function SeedBuilderSummaryActions({
  canPlay,
  isRouteSeed,
  objectiveCount,
  routeRevealMode,
  routeVisibleCount,
  startingArea,
  status,
  statusTone,
  onClear,
  onCopySeed,
  onPlaySeed
}) {
  const startingAreaLabel = areaLabels[startingArea] ?? startingArea;
  const summary = isRouteSeed
    ? `Route seed · ${startingAreaLabel} · ${routeVisibleCount} visible · ${ROUTE_REVEAL_MODE_LABELS[routeRevealMode]} · ${pluralizeSquares(objectiveCount)}`
    : `Square seed · ${startingAreaLabel} · ${pluralizeSquares(objectiveCount)}`;

  return (
    <section className="seed-builder-summary-actions" aria-label="Seed summary actions" aria-live="polite">
      <div className="seed-builder-summary-copy">
        <span>{summary}</span>
        {status ? (
          <strong className={`seed-builder-status ${statusTone ? `is-${statusTone}` : ""}`}>
            {status}
          </strong>
        ) : null}
      </div>
      <div className="seed-builder-summary-buttons">
        <button
          className="secondary-button seed-builder-clear-button"
          type="button"
          disabled={objectiveCount === 0}
          onClick={onClear}
        >
          Clear
        </button>
        <button className="secondary-button" type="button" onClick={onCopySeed}>
          Copy Seed
        </button>
        <button className="primary-button reward-button" type="button" onClick={onPlaySeed} disabled={!canPlay}>
          Play Seed
        </button>
      </div>
    </section>
  );
}

function ClearTimelineModal({ onClose, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="panel modal-card danger-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seed-builder-clear-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Warning</p>
        <h2 id="seed-builder-clear-title">Clear all seed squares?</h2>
        <p className="modal-copy">
          This removes every selected square from the Seed Builder.
        </p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Keep Seed
          </button>
          <button className="secondary-button danger-button" type="button" onClick={onConfirm}>
            Clear Seed
          </button>
        </div>
      </div>
    </div>
  );
}

export function SeedBuilderPanel({
  draft,
  drillSettings,
  onUpdateDraft,
  onStartSession,
  onCopySeed
}) {
  const normalizedDraft = normalizeSeedBuilderDraft(draft);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("");
  const [seedFieldValue, setSeedFieldValue] = useState("");
  const [activeDragData, setActiveDragData] = useState(null);
  const [timelineInsertPreviewIndex, setTimelineInsertPreviewIndex] = useState(-1);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const usedObjectiveIds = useMemo(
    () => new Set(normalizedDraft.objectiveIds),
    [normalizedDraft.objectiveIds]
  );
  const timelineObjectives = normalizedDraft.objectiveIds
    .map((objectiveId) => objectivesById[objectiveId])
    .filter(Boolean);
  const shelfObjectives = objectivesByArea[normalizedDraft.selectedArea] ?? [];
  const isRouteSeed = normalizedDraft.sessionType === ROUTE_SESSION_TYPE;
  const launchState = useMemo(() => {
    try {
      return buildSeedBuilderLaunchState(normalizedDraft, { drillSettings });
    } catch {
      return null;
    }
  }, [normalizedDraft, drillSettings]);
  const currentSeed = launchState?.exportSeed ?? "";
  const canPlay = Boolean(launchState?.sessionSpec);
  const routeVisibleMax = Math.max(
    ROUTE_VISIBLE_COUNT_MIN,
    Math.min(timelineObjectives.length || ROUTE_VISIBLE_COUNT_MIN, ROUTE_VISIBLE_COUNT_MAX)
  );
  useEffect(() => {
    setSeedFieldValue(currentSeed);
  }, [currentSeed]);

  function commitDraft(nextDraft, nextStatus = "") {
    onUpdateDraft(normalizeSeedBuilderDraft(nextDraft));
    setStatus(nextStatus);
    setStatusTone("");
  }

  function commitObjectiveIds(objectiveIds, nextStatus = "") {
    commitDraft(
      normalizeSeedBuilderDraftAfterObjectiveChange(normalizedDraft, objectiveIds),
      nextStatus
    );
  }

  function showError(message) {
    setStatus(message);
    setStatusTone("error");
  }

  function importSeed() {
    const seedInput = seedFieldValue.trim();
    if (!seedInput) {
      showError("Paste a seed or phrase before importing.");
      return;
    }

    const resolvedSeed = resolveSeedInput(seedInput, normalizedDraft.sessionType);
    if (!resolvedSeed.sessionSpec?.objectiveIds?.length) {
      showError("That seed did not resolve to any squares.");
      return;
    }

    const importedDraft = createSeedBuilderDraftFromSessionSpec(
      resolvedSeed.sessionSpec,
      normalizedDraft
    );
    commitDraft(importedDraft, resolvedSeed.warning || "Seed imported.");
  }

  function updateSessionType(sessionType) {
    commitDraft({
      ...normalizedDraft,
      sessionType
    });
  }

  function updateRouteVisibleCount(value) {
    commitDraft({
      ...normalizedDraft,
      routeVisibleCount: value
    });
  }

  function updateRouteRevealMode(value) {
    commitDraft({
      ...normalizedDraft,
      routeRevealMode: value
    });
  }

  function updateRouteVisionTrainingEnabled(value) {
    commitDraft({
      ...normalizedDraft,
      routeVisionTrainingEnabled: value
    });
  }

  function updateStartingArea(value) {
    commitDraft({
      ...normalizedDraft,
      startingArea: value
    });
  }

  function selectArea(area) {
    onUpdateDraft({
      ...normalizedDraft,
      selectedArea: area
    });
    setStatus("");
    setStatusTone("");
  }

  function addObjective(objectiveId, insertIndex = normalizedDraft.objectiveIds.length) {
    const nextObjectiveIds = insertSeedBuilderObjective(
      normalizedDraft.objectiveIds,
      objectiveId,
      insertIndex
    );
    if (nextObjectiveIds.length === normalizedDraft.objectiveIds.length) {
      return;
    }

    commitObjectiveIds(nextObjectiveIds);
  }

  function moveObjective(fromIndex, toIndex) {
    commitObjectiveIds(
      moveSeedBuilderObjective(normalizedDraft.objectiveIds, fromIndex, toIndex)
    );
  }

  function removeObjective(index) {
    commitObjectiveIds(
      removeSeedBuilderObjective(normalizedDraft.objectiveIds, index)
    );
  }

  function clearObjectives() {
    if (normalizedDraft.objectiveIds.length === 0) {
      return;
    }

    commitObjectiveIds([], "Seed cleared.");
  }

  function handleDragStart(event) {
    setActiveDragData(event.active.data.current ?? null);
    setTimelineInsertPreviewIndex(-1);
  }

  function handleDragOver(event) {
    setTimelineInsertPreviewIndex(
      resolvePickerTimelineInsertPreviewIndex(
        event.active?.id,
        event.over?.id,
        normalizedDraft.objectiveIds
      )
    );
  }

  function handleDragCancel() {
    setActiveDragData(null);
    setTimelineInsertPreviewIndex(-1);
  }

  function handleDragEnd(event) {
    const activeId = event.active?.id;
    const overId = event.over?.id;
    setActiveDragData(null);
    setTimelineInsertPreviewIndex(-1);

    if (!activeId) {
      return;
    }

    const activeTimelineObjectiveId = parseTimelineObjectiveId(activeId);
    const activeRouteObjectiveId = parseRouteObjectiveId(activeId);
    const activePickerObjectiveId = parsePickerObjectiveId(activeId);
    const overTimelineObjectiveId = parseTimelineObjectiveId(overId);
    const overRouteObjectiveId = parseRouteObjectiveId(overId);
    const isTimelineAppendTarget =
      overId === TIMELINE_CONTAINER_ID || overId === TIMELINE_END_ID;

    if (activePickerObjectiveId) {
      if (overTimelineObjectiveId) {
        const insertIndex = findObjectiveIndex(
          normalizedDraft.objectiveIds,
          overTimelineObjectiveId
        );
        if (insertIndex >= 0) {
          addObjective(activePickerObjectiveId, insertIndex);
        }
        return;
      }

      if (isTimelineAppendTarget) {
        addObjective(activePickerObjectiveId);
      }
      return;
    }

    if (activeRouteObjectiveId) {
      const fromIndex = findObjectiveIndex(
        normalizedDraft.objectiveIds,
        activeRouteObjectiveId
      );
      const toIndex = findObjectiveIndex(
        normalizedDraft.objectiveIds,
        overRouteObjectiveId
      );
      if (fromIndex < 0 || toIndex < 0) {
        if (fromIndex >= 0) {
          removeObjective(fromIndex);
        }
        return;
      }

      moveObjective(fromIndex, toIndex);
      return;
    }

    if (!activeTimelineObjectiveId) {
      return;
    }

    const fromIndex = findObjectiveIndex(
      normalizedDraft.objectiveIds,
      activeTimelineObjectiveId
    );
    if (fromIndex < 0) {
      return;
    }

    if (overTimelineObjectiveId) {
      const toIndex = findObjectiveIndex(
        normalizedDraft.objectiveIds,
        overTimelineObjectiveId
      );
      if (toIndex >= 0) {
        moveObjective(fromIndex, toIndex);
      }
      return;
    }

    if (isTimelineAppendTarget) {
      moveObjective(fromIndex, normalizedDraft.objectiveIds.length - 1);
      return;
    }

    removeObjective(fromIndex);
  }

  async function copySeed() {
    if (!launchState?.exportSeed) {
      showError("Build a valid seed before copying.");
      return;
    }

    const copied = await onCopySeed(launchState.exportSeed);
    setStatus(copied ? "Seed copied." : "Copy failed.");
    setStatusTone(copied ? "" : "error");
  }

  function playSeed() {
    if (!launchState?.sessionSpec) {
      showError(
        isRouteSeed
          ? "Route seeds need at least two squares."
          : "Add at least one square before playing."
      );
      return;
    }

    onStartSession(launchState);
  }

  return (
    <section className="panel seed-builder-panel">
      <div className="panel-heading seed-builder-heading">
        <div>
          <p className="eyebrow">Exercise Builder</p>
          <h1>Build a custom seed!</h1>
        </div>
        
      </div>

      <div className={`seed-builder-workbench ${isRouteSeed ? "is-route-mode" : "is-square-mode"}`}>
        <SeedSetupSection
          startingArea={normalizedDraft.startingArea}
          seedFieldValue={seedFieldValue}
          sessionType={normalizedDraft.sessionType}
          onImport={importSeed}
          onSeedFieldChange={(value) => {
            setSeedFieldValue(value);
            setStatus("");
            setStatusTone("");
          }}
          onStartingAreaChange={updateStartingArea}
          onSessionTypeChange={updateSessionType}
        />

        {isRouteSeed ? (
          <RouteBehaviorSection
            routeVisibleMax={routeVisibleMax}
            routeVisibleCount={normalizedDraft.routeVisibleCount}
            routeRevealMode={normalizedDraft.routeRevealMode}
            routeVisionTrainingEnabled={normalizedDraft.routeVisionTrainingEnabled}
            onRouteRevealModeChange={updateRouteRevealMode}
            onRouteVisibleCountChange={updateRouteVisibleCount}
            onRouteVisionTrainingEnabledChange={updateRouteVisionTrainingEnabled}
          />
        ) : null}

        {isRouteSeed ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <RouteVisibilityGroupsPreview
              objectives={timelineObjectives}
              visibleCount={normalizedDraft.routeVisibleCount}
            />
            <SeedBuilderPicker
              activeDragKind=""
              addLabel="Add to route"
              dragDisabled
              selectedArea={normalizedDraft.selectedArea}
              objectives={shelfObjectives}
              usedObjectiveIds={usedObjectiveIds}
              onSelectArea={selectArea}
              onAdd={addObjective}
            />
            <DragOverlay modifiers={[snapCenterToCursor]}>
              <SeedBuilderTilePreview dragData={activeDragData} />
            </DragOverlay>
          </DndContext>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SeedBuilderTimeline
              previewDragData={activeDragData?.kind === "picker" ? activeDragData : null}
              previewIndex={timelineInsertPreviewIndex}
              objectives={timelineObjectives}
            />
            <SeedBuilderPicker
              activeDragKind={activeDragData?.kind ?? ""}
              addLabel="Add to order"
              selectedArea={normalizedDraft.selectedArea}
              objectives={shelfObjectives}
              usedObjectiveIds={usedObjectiveIds}
              onSelectArea={selectArea}
              onAdd={addObjective}
            />
            <DragOverlay modifiers={[snapCenterToCursor]}>
              <SeedBuilderTilePreview dragData={activeDragData} />
            </DragOverlay>
          </DndContext>
        )}

        <SeedBuilderSummaryActions
          canPlay={canPlay}
          isRouteSeed={isRouteSeed}
          objectiveCount={timelineObjectives.length}
          routeRevealMode={normalizedDraft.routeRevealMode}
          routeVisibleCount={normalizedDraft.routeVisibleCount}
          startingArea={normalizedDraft.startingArea}
          status={status}
          statusTone={statusTone}
          onClear={() => setIsClearOpen(true)}
          onCopySeed={copySeed}
          onPlaySeed={playSeed}
        />
      </div>

      {isClearOpen ? (
        <ClearTimelineModal
          onClose={() => setIsClearOpen(false)}
          onConfirm={() => {
            clearObjectives();
            setIsClearOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
