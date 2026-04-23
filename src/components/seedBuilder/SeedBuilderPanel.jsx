import { useEffect, useMemo, useState } from "react";
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
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { areaLabels, objectiveAreaOrder } from "../../data/areaMeta.js";
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

const TIMELINE_CONTAINER_ID = "seed-builder-timeline";
const TIMELINE_END_ID = "seed-builder-timeline-end";

function timelineDragId(objectiveId) {
  return `timeline:${objectiveId}`;
}

function pickerDragId(objectiveId) {
  return `picker:${objectiveId}`;
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

function objectiveDragData(kind, objective, index = null) {
  return {
    kind,
    objectiveId: objective.id,
    index,
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
    <article className={`seed-builder-drag-preview ${districtToneClassName(dragData.district)}`}>
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
    data: objectiveDragData("timeline", objective, index)
  });
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      className={`seed-builder-timeline-card ${isDragging ? "is-dragging" : ""} ${districtToneClassName(objective.district)}`}
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

function PickerTile({
  objective,
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
    disabled: used
  });

  return (
    <article
      className={`seed-builder-shelf-card ${used ? "is-used" : ""} ${isDragging ? "is-dragging" : ""} ${districtToneClassName(objective.district)}`}
      ref={setNodeRef}
      aria-disabled={used}
      {...attributes}
      {...listeners}
    >
      <div className="seed-builder-card-copy">
        <strong>{compactObjectiveLabel(objective)}</strong>
        <SeedBuilderCardMeta objective={objective} />
      </div>
      <button
        className="secondary-button seed-builder-add-button"
        type="button"
        disabled={used}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={() => onAdd(objective.id)}
      >
        {used ? "Added" : "Add"}
      </button>
    </article>
  );
}

function SeedBuilderTimeline({
  objectives
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

  return (
    <div
      className={`seed-builder-timeline ${showEmptyState ? "is-empty" : ""} ${isOver ? "is-over" : ""}`}
      ref={setNodeRef}
      aria-label="Seed timeline"
    >
      {showEmptyState ? (
        <div className="seed-builder-empty-timeline">
          <p className="eyebrow">Timeline</p>
          <h2>Drag squares here</h2>
          <p>Pick a level below, then add squares in the order you want to play.</p>
        </div>
      ) : (
        <SortableContext
          items={objectives.map((objective) => timelineDragId(objective.id))}
          strategy={horizontalListSortingStrategy}
        >
          {objectives.map((objective, index) => (
            <TimelineTile
              key={objective.id}
              objective={objective}
              index={index}
            />
          ))}
          <div
            className={`seed-builder-timeline-end-drop ${isOverEnd ? "is-over" : ""}`}
            ref={setEndNodeRef}
            aria-label="Drop here to append"
          />
        </SortableContext>
      )}
    </div>
  );
}

function SeedBuilderPicker({
  activeDragKind,
  selectedArea,
  objectives,
  usedObjectiveIds,
  onSelectArea,
  onAdd
}) {
  const canRemoveByDrop = activeDragKind === "timeline";

  return (
    <div
      className={`seed-builder-picker ${canRemoveByDrop ? "is-remove-target" : ""}`}
      aria-label="Square picker"
    >
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
            used={usedObjectiveIds.has(objective.id)}
            onAdd={onAdd}
          />
        ))}
      </div>
    </div>
  );
}

function SeedBuilderSeedBar({
  canPlay,
  isRouteSeed,
  routeVisibleMax,
  routeVisibleCount,
  routeRevealMode,
  seedFieldValue,
  sessionType,
  onCopySeed,
  onImport,
  onPlaySeed,
  onRouteRevealModeChange,
  onRouteVisibleCountChange,
  onSeedFieldChange,
  onSessionTypeChange
}) {
  return (
    <div className={`seed-builder-seed-bar ${isRouteSeed ? "has-route-config" : ""}`} aria-label="Seed controls">
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
            { value: PRACTICE_SESSION_TYPE, label: "Practice" },
            { value: ROUTE_SESSION_TYPE, label: "Route" }
          ]}
          onChange={onSessionTypeChange}
        />
        <button className="secondary-button" type="button" onClick={onCopySeed}>
          Copy Seed
        </button>
        <button className="primary-button reward-button" type="button" onClick={onPlaySeed} disabled={!canPlay}>
          Play Seed
        </button>
      </div>

      {isRouteSeed ? (
        <div className="seed-builder-route-row">
          <label className="field seed-builder-visible-field">
            <span>Visible</span>
            <input
              type="number"
              min={ROUTE_VISIBLE_COUNT_MIN}
              max={routeVisibleMax}
              value={routeVisibleCount}
              onChange={(event) => onRouteVisibleCountChange(event.target.value)}
            />
          </label>
          <SegmentedChoice
            label="Reveal"
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
        </div>
      ) : null}
    </div>
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
        <h2 id="seed-builder-clear-title">Clear all timeline squares?</h2>
        <p className="modal-copy">
          This removes every square from the Seed Builder timeline.
        </p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Keep Timeline
          </button>
          <button className="secondary-button danger-button" type="button" onClick={onConfirm}>
            Clear Timeline
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
  const overlayModifier = useMemo(
    () => ({ transform }) => ({
      ...transform,
      x: transform.x - 12,
      y: transform.y - 58
    }),
    []
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
      routeVisibleCount: Number(value)
    });
  }

  function updateRouteRevealMode(value) {
    commitDraft({
      ...normalizedDraft,
      routeRevealMode: value
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

    commitObjectiveIds([], "Timeline cleared.");
  }

  function handleDragStart(event) {
    setActiveDragData(event.active.data.current ?? null);
  }

  function handleDragCancel() {
    setActiveDragData(null);
  }

  function handleDragEnd(event) {
    const activeData = event.active.data.current;
    const overData = event.over?.data.current;
    const overId = event.over?.id;
    setActiveDragData(null);

    if (!activeData) {
      return;
    }

    const isTimelineTarget =
      overData?.kind === "timeline" ||
      overData?.kind === "timeline-container" ||
      overData?.kind === "timeline-end" ||
      overId === TIMELINE_CONTAINER_ID ||
      overId === TIMELINE_END_ID;

    if (activeData.kind === "picker") {
      if (overData?.kind === "timeline") {
        addObjective(activeData.objectiveId, overData.index);
        return;
      }

      if (isTimelineTarget) {
        addObjective(activeData.objectiveId);
      }
      return;
    }

    if (activeData.kind !== "timeline") {
      return;
    }

    const fromIndex = normalizedDraft.objectiveIds.indexOf(activeData.objectiveId);
    if (fromIndex < 0) {
      return;
    }

    if (overData?.kind === "timeline") {
      moveObjective(fromIndex, overData.index);
      return;
    }

    if (isTimelineTarget) {
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
          <p className="eyebrow">Seed Builder</p>
          <h1>Build a custom seed</h1>
        </div>
        <p className="panel-note">
          Arrange squares into a normal replayable seed, then run it as practice or route.
        </p>
      </div>

      <div className="seed-builder-workbench">
        <SeedBuilderSeedBar
          canPlay={canPlay}
          isRouteSeed={isRouteSeed}
          routeVisibleMax={routeVisibleMax}
          routeVisibleCount={normalizedDraft.routeVisibleCount}
          routeRevealMode={normalizedDraft.routeRevealMode}
          seedFieldValue={seedFieldValue}
          sessionType={normalizedDraft.sessionType}
          onCopySeed={copySeed}
          onImport={importSeed}
          onSeedFieldChange={(value) => {
            setSeedFieldValue(value);
            setStatus("");
            setStatusTone("");
          }}
          onPlaySeed={playSeed}
          onRouteRevealModeChange={updateRouteRevealMode}
          onRouteVisibleCountChange={updateRouteVisibleCount}
          onSessionTypeChange={updateSessionType}
        />

        <div className="seed-builder-status-row" aria-live="polite">
          <span>
            {timelineObjectives.length} square{timelineObjectives.length === 1 ? "" : "s"}
          </span>
          <div className="seed-builder-status-actions">
            {status ? (
              <span className={`seed-builder-status ${statusTone ? `is-${statusTone}` : ""}`}>
                {status}
              </span>
            ) : null}
            <button
              className="secondary-button seed-builder-clear-button"
              type="button"
              disabled={timelineObjectives.length === 0}
              onClick={() => setIsClearOpen(true)}
            >
              Clear
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SeedBuilderTimeline objectives={timelineObjectives} />
          <SeedBuilderPicker
            activeDragKind={activeDragData?.kind ?? ""}
            selectedArea={normalizedDraft.selectedArea}
            objectives={shelfObjectives}
            usedObjectiveIds={usedObjectiveIds}
            onSelectArea={selectArea}
            onAdd={addObjective}
          />
          <DragOverlay modifiers={[overlayModifier]}>
            <SeedBuilderTilePreview dragData={activeDragData} />
          </DragOverlay>
        </DndContext>
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
