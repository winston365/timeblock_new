# Cross-Cutting Logic Analysis - Complete Documentation

## Overview
Comprehensive analysis of cross-feature dependencies, shared logic, and coupling issues in the TimeBlock Planner codebase (16 features, 51 files analyzed).

## Documents Included

### 1. ANALYSIS_SUMMARY.md
**Purpose:** Executive summary for decision makers
**Length:** 5 pages
**Contains:**
- Key findings at a glance
- Feature dependency table
- Cross-cutting concerns overview
- Tight coupling issues ranked by impact
- Refactoring priorities with effort/impact ratings
- Metrics before/after refactoring
- Recommended next steps
- Long-term vision

**Best for:** Project leads, architects, sprint planners

---

### 2. cross_cutting_analysis.md
**Purpose:** High-level overview of all cross-cutting logic
**Length:** 8 pages
**Contains:**
- Feature overview (16 features listed)
- Feature dependency map
- Hub features analysis (schedule, waifu, energy)
- Shared stores catalog
- Cross-cutting concerns (task completion, AI, notifications, waifu, sync)
- Feature coupling analysis (high/medium/low)
- Shared hooks inventory
- Shared utilities & type system
- Communication patterns
- Tight coupling issues & refactoring opportunities
- Feature interaction diagram
- Refactoring patterns

**Best for:** Developers, code reviewers, understanding the full picture

---

### 3. feature_dependency_details.md
**Purpose:** Detailed breakdown of each feature's dependencies
**Length:** 12 pages
**Contains:**
- Import graph for each feature (6 features with imports)
- Store usage across features
- Service layer dependencies (AI, sync, gameplay)
- Hook reuse patterns with file locations
- Type system dependencies
- Component sharing patterns
- Data flow through stores (with diagrams)
- Problematic patterns identified
- Feature health scores (excellent/good/fair/needs refactoring)
- Refactoring priority matrix

**Best for:** Technical leads, refactoring architects, code quality

---

### 4. refactoring_strategies.md
**Purpose:** Actionable refactoring plan with code examples
**Length:** 20+ pages
**Contains:**
- Executive summary of current vs target state
- 5 priority refactoring strategies:
  1. Extract shared task components (2 days)
  2. Centralize waifu messaging (3 days)
  3. Standardize notifications (2 days)
  4. Implement event bus (4 days)
  5. Consolidate store usage (1 day)
- For each priority:
  - Detailed issue description
  - Current vs proposed structure
  - Implementation steps
  - Code examples (before/after)
  - Coupling impact analysis
- Implementation timeline (10 sprints)
- Testing strategy
- Rollback strategy

**Best for:** Developers implementing refactoring, sprint planning

---

### 5. ANALYSIS_SOURCE_REFERENCES.md
**Purpose:** Verify all findings with actual code references
**Length:** 10 pages
**Contains:**
- Analysis methodology
- Feature list with directory structure
- All 15 cross-feature imports with line numbers
- Shared stores with usage locations
- Feature-specific hooks and stores
- Toast notification files
- AI service usage with specific functions
- Task completion handler chain
- Key files analyzed (51 total)
- Verified statistics
- Type system dependencies
- Communication patterns identified
- Verification checklist (all passed)
- Commands to verify findings yourself
- Confidence levels for each finding

**Best for:** Verification, documentation, repeatability

---

### 6. INDEX.md (this file)
**Purpose:** Navigation and document overview
**Length:** 2 pages

---

## Quick Reference: Feature Dependency Matrix

### Hub Features (Most Connected)
| Feature | Imports FROM | Exports TO | Priority |
|---------|--------------|-----------|----------|
| **schedule** | None | 2 features | P1: Extract components |
| **waifu** | None | 6 features | P2: Centralize messaging |
| **energy** | None | 3 features | Low |

### Dependent Features
| Feature | Imports FROM | Priority |
|---------|--------------|----------|
| **tasks** | schedule (3) | P1: Move to shared |
| **insight** | waifu, energy | P2: Use service |
| **gemini** | waifu, energy | P2: Use service |
| **shop** | waifu | P2: Use service |
| **template** | schedule | P1: Move to shared |

### Isolated Features (Healthy)
| Feature | Status |
|---------|--------|
| focus, feedback, gamification, goals, settings, stats, quickadd | No external imports |

---

## Cross-Cutting Concerns at a Glance

| Concern | Scope | Impact | Priority |
|---------|-------|--------|----------|
| Task Completion Pipeline | 5 features | HIGH | Monitor |
| AI Integration | 4 features | MEDIUM | Low |
| Toast Notifications | 9 files | MEDIUM | P3 |
| Waifu Messaging | 6 features | HIGH | P2 |
| Firebase Sync | All features | HIGH | Monitor |

---

## Top Findings

1. **useWaifu() is imported by 6 features** - Creates highest coupling point
   - Impact: Change to waifu breaks 6 features
   - Solution: Create companionService wrapper

2. **TaskCard/TaskModal are schedule internals imported elsewhere** - Structural coupling
   - Impact: Schedule changes break tasks and template features
   - Solution: Move to shared/components/task/

3. **9 files use direct react-hot-toast imports** - Inconsistent pattern
   - Impact: Hard to customize notifications globally
   - Solution: Create notificationService wrapper

4. **Missing event bus for gameplay events** - Architectural gap
   - Impact: Cross-feature coordination is unclear
   - Solution: Implement event bus with typed events

5. **settingsStore used by 7 features** - Central dependency
   - Impact: Changes to settings break 7 features
   - Note: This is expected and healthy (foundational)

---

## Reading Guide by Role

### Product Manager / Project Lead
1. Start with **ANALYSIS_SUMMARY.md** (5 min read)
2. Review "Refactoring Recommendations" section
3. Check timeline and effort estimates
4. Decide on priorities

### Tech Lead / Architect
1. Read **ANALYSIS_SUMMARY.md** (15 min)
2. Review **feature_dependency_details.md** (30 min)
3. Study **refactoring_strategies.md** (45 min)
4. Plan implementation with team

### Developer Implementing Refactoring
1. Review **refactoring_strategies.md** for relevant priority (30 min)
2. Refer to code examples (before/after)
3. Check **ANALYSIS_SOURCE_REFERENCES.md** for verification commands
4. Implement with confidence

### Code Reviewer
1. Check **feature_dependency_details.md** health scores
2. Review **cross_cutting_analysis.md** communication patterns
3. Verify changes don't introduce new coupling
4. Reference **ANALYSIS_SOURCE_REFERENCES.md** for verification

### New Team Member
1. Start with **cross_cutting_analysis.md** (20 min)
2. Study feature interaction diagram
3. Learn about shared stores and hooks
4. Understand communication patterns

---

## Key Statistics

### Current State
- **16 features** with varying degrees of coupling
- **15 cross-feature import instances**
- **9 import paths** between features
- **7 shared stores** used across features
- **4 shared hooks** imported cross-feature
- **9 files** with inconsistent toast usage
- **5 handler chain** affecting multiple features
- **51 total feature files** analyzed

### Target State (After Refactoring)
- **0 direct cross-feature imports**
- **1 event bus** for coordination
- **1 notification service** for all toasts
- **1 companion service** for waifu logic
- **Shared component library** for reusable UI
- **Consistent store access patterns**

---

## Implementation Roadmap

### Phase 1: Foundation (Sprint 1-2)
- Extract shared task components
- Establish shared component library pattern

### Phase 2: Core Logic (Sprint 3-4)
- Centralize waifu messaging
- Create companion service

### Phase 3: UX (Sprint 5-6)
- Standardize notifications
- Create notification service

### Phase 4: Architecture (Sprint 7-8)
- Implement event bus
- Update task completion service

### Phase 5: Polish (Sprint 9-10)
- Standardize store access
- Create useAppState wrapper
- Document patterns in CLAUDE.md

---

## How to Use These Documents

### For Discussion
Print and discuss with team:
- Feature dependency matrix
- Cross-cutting concerns table
- Feature interaction diagram
- Refactoring priority matrix

### For Implementation
Keep open while coding:
- Refactoring strategies guide
- Code examples (before/after)
- Implementation steps
- Testing strategy

### For Verification
Run commands from:
- ANALYSIS_SOURCE_REFERENCES.md
- Verify findings yourself
- Ensure no new coupling introduced

### For Documentation
Update after each phase:
- CLAUDE.md with new patterns
- Architecture decisions
- Feature boundaries

---

## Next Steps

1. **Share with team** - Distribute all documents
2. **Review & discuss** - 1-2 hour meeting with stakeholders
3. **Prioritize** - Choose which refactoring priorities to tackle first
4. **Plan sprints** - Allocate resources and timeline
5. **Begin** - Start with Priority 1 (extract task components)
6. **Monitor** - Watch for new cross-feature dependencies
7. **Update** - Revise CLAUDE.md after each phase

---

## Questions?

If findings seem unclear:
1. Check **ANALYSIS_SOURCE_REFERENCES.md** for verification
2. Run the provided grep commands yourself
3. Read the actual feature files mentioned
4. Cross-reference with code examples in refactoring guide

All findings are based on actual code inspection, not assumptions.

