# Runtime ABI Inventory

Phase 0 keeper doc for the Runtime consolidation spike. Line references are to the current `main` worktree as of 2026-06-22.

## 1. Standalone emitted Factory ABI

### 1.1 Helper symbols the emitted standalone Factory requires in module scope

The transpiled-main standalone path emits `STANDALONE_RUNTIME_HELPERS` verbatim before `createIndicator(PineJS)` (`src/factory/indicator-factory.ts:113-1290`, injected at `:4689`). The emitted constructor then assumes the following helpers already exist:

| Symbol | Defined at | Consumed at | Notes |
| --- | --- | --- | --- |
| `__createStubNamespaces` | `indicator-factory.ts:608-616` | `:4732` | Creates raw `box` / `line` / `label` / `table` / `str` namespaces. |
| `__createVisualStubs` | `indicator-factory.ts:867-875` | `:4734` | Wraps raw drawing namespaces with visual-event proxies. |
| `__normalizeVisualStyle` | `indicator-factory.ts:681-815` | `:1323-1327` | Enriches emitted visual events with style semantics. |
| `__createVisualStdProxy` | `indicator-factory.ts:888-916` | `:1377-1381` | Wraps `Std.*` visual helpers and pushes plot values/events. |
| `__createInput` | `indicator-factory.ts:918-968` | `:1383` | Builds the `input`/`input.*` callable. |
| `__createTimeframe` | `indicator-factory.ts:1159-1172` | `:1462` | Builds the `timeframe` namespace. |
| `__createMathNamespace` | `indicator-factory.ts:1229-1239` | `:1463` | Builds the `math` namespace. |
| `__createSyminfo` | `indicator-factory.ts:1210-1227` | `:1475` | Builds the `syminfo` namespace. |
| `__createBarstate` | `indicator-factory.ts:1174-1208` | `:1476` | Builds the per-bar `barstate` object. |
| `__createArrayNamespace` | `indicator-factory.ts:1253-1288` | `:1672` | Builds the standalone `array` namespace. |
| `__callableNamespace` | `indicator-factory.ts:1241-1251` | `:1717-1719` | Builds callable `chart` / `format` / `string` placeholders. |
| `__timeframeToSeconds` | `indicator-factory.ts:970-989` | `:1600-1601`, `:1674` | Used by `request.security` and `time_close`. |
| `__readClockAt` | `indicator-factory.ts:1018-1057` | `:559-579`, `:1569-1584`, `:1696` | Timezone-aware clock extraction. |
| `__isInSessionAt` | `indicator-factory.ts:1079-1117` | `:1677-1690` | Powers the `session.*` getters. |
| `__compatTime` | `indicator-factory.ts:1119-1135` | `:1335-1344` | Overrides `Std.time` for Pine-compatible calls. |
| `__compatDatePart` | `indicator-factory.ts:1137-1157` | `:1346-1373` | Overrides `Std.dayofweek/hour/...` compatibility calls. |
| `__coercePlotValue` / `__coerceShapePlotValue` | `indicator-factory.ts:124-142` | `:1384-1413` | Plot-value coercion for standalone `plot*` wrappers. |

### 1.2 Constructor-time state and wrapper symbols

For transpiled-main standalone factories, the constructor creates these symbols before `this.main` is assigned (`src/factory/indicator-factory.ts:4729-4747`):

| Symbol | Created at | Kind | Why it matters |
| --- | --- | --- | --- |
| `__stubsRaw` | `indicator-factory.ts:4732` | constructor-local | Owns the raw namespace instances and their hidden stores. |
| `__visualCtx` | `indicator-factory.ts:4733` | constructor-local | Mutable event sink pointer shared by all visual proxies. |
| `__stubs` | `indicator-factory.ts:4734` | constructor-local | Visual-event-wrapped namespace bag passed into user code. |
| `__colorMap` | `indicator-factory.ts:4735` | constructor-local | `color.*` constants bag. |
| `__previousBarTime` | `indicator-factory.ts:4736` | constructor-local | Drives `barstate.isnew`. |
| `__fallbackBarIndex` | `indicator-factory.ts:4737` | constructor-local | Bar-index fallback when runtime context lacks one. |
| `__processedBars` | `indicator-factory.ts:4738` | constructor-local | `time(..., bars_back=...)` gating. |
| `__processedBarKey` | `indicator-factory.ts:4739` | constructor-local | Dedupes repeated execution on the same bar. |
| `__requestSecurityState` | `indicator-factory.ts:4740` | constructor-local | Per-call-site `request.security` bucket state. |
| `__requestSecurityCallCounter` | `indicator-factory.ts:4741`, reset at `:1301` | constructor-local mutable counter | Reassigned to `0` each bar so call-site keys remain ordinal-by-bar. |

### 1.3 Per-bar symbols passed into the compiled script

`generateStandaloneRuntimeMainBody()` constructs the standalone `compiledScript` wrapper (`src/factory/indicator-factory.ts:1292-1926`). The ordered parameter ABI is defined at `:1756-1823` and invoked at `:1827-1894`:

`Std, context, input, plot, indicator, study, strategy, color, ta, math, timeframe, plotshape, plotchar, plotarrow, hline, bgcolor, fill, barcolor, box, line, label, table, str, syminfo, barstate, shape, location, size, alertcondition, alert, request, session, array, time, time_close, time_tradingday, bar_index, hour, minute, second, year, month, dayofmonth, dayofweek, timestamp, chart, format, string, xloc, yloc, extend, position, order, text, display, ticker, barmerge, close, open, high, low, volume, hl2, hlc3, ohlc4, log`

Those names are created in four clusters:

| Cluster | Symbols | Created at |
| --- | --- | --- |
| Visual/indicator call wrappers | `input`, `plot`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `bgcolor`, `fill`, `barcolor`, `indicator`, `study`, `strategy`, `alertcondition`, `alert` | `indicator-factory.ts:1383-1461`, `:1506-1507` |
| Runtime-backed namespaces | `timeframe`, `math`, `ta`, `color`, `box`, `line`, `label`, `table`, `str`, `syminfo`, `barstate`, `request`, `session`, `array`, `chart`, `format`, `string`, `log`, `ticker` | `indicator-factory.ts:1462-1476`, `:1589-1740`, `:1717-1720` |
| Constant / bag-of-values namespaces | `shape`, `location`, `size`, `xloc`, `yloc`, `extend`, `position`, `order`, `text`, `display`, `barmerge` | `indicator-factory.ts:1477-1505`, `:1721-1746` |
| Scalar bar fields | `time`, `time_close`, `time_tradingday`, `bar_index`, `hour`, `minute`, `second`, `year`, `month`, `dayofmonth`, `dayofweek`, `timestamp`, `close`, `open`, `high`, `low`, `volume`, `hl2`, `hlc3`, `ohlc4` | `indicator-factory.ts:1673-1716`, `:1747-1754` |

### 1.4 Namespace constants exposed to user code

The emitted standalone helper string hard-codes these runtime-visible constant bags:

| Namespace | Constants | Defined at |
| --- | --- | --- |
| `line` | `style_solid`, `style_dotted`, `style_dashed` | `indicator-factory.ts:249-252` |
| `label` | `style_label_up`, `style_label_down`, `style_label_left`, `style_label_right` | `indicator-factory.ts:491-495` |
| `shape` | `triangleup`, `triangledown`, `arrowup`, `arrowdown`, `circle`, `cross`, `diamond`, `flag`, `square`, `labelup`, `labeldown`, `xcross` | `indicator-factory.ts:1477-1490` |
| `location` | `abovebar`, `belowbar`, `top`, `bottom`, `absolute` | `indicator-factory.ts:1491-1497` |
| `size` | `auto`, `tiny`, `small`, `normal`, `large`, `huge` | `indicator-factory.ts:1498-1505` |
| `xloc` | `bar_index`, `bar_time` | `indicator-factory.ts:1721` |
| `yloc` | `price`, `abovebar`, `belowbar` | `indicator-factory.ts:1722` |
| `extend` | `none`, `left`, `right`, `both` | `indicator-factory.ts:1723` |
| `order` | `ascending`, `descending` | `indicator-factory.ts:1725` |
| `text` | `align_left`, `align_center`, `align_right`, `align_top`, `align_bottom` | `indicator-factory.ts:1726-1732` |
| `barmerge` | `gaps_on`, `gaps_off`, `lookahead_on`, `lookahead_off` | `indicator-factory.ts:1741-1746` |

## 2. Per-instance state holders and where they are created

### 2.1 PineJS path (`buildIndicatorFactory`)

| Holder | Created at | Scope | Details |
| --- | --- | --- | --- |
| `colorToSlot` / `resolveBgSlot` | `indicator-factory.ts:2721-2728` | **factory closure, outside constructor** | Used only by auto-bg-colorer (`:4200-4204`). This is *not* constructor-local today. |
| `_previousBarTime` | `indicator-factory.ts:2790` | constructor-local | Previous bar open time for `barstate.isnew`; updated at `:3434-3436`. |
| `_fallbackBarIndex` | `indicator-factory.ts:2792` | constructor-local | Fallback cursor when runtime context lacks `barIndex`; updated at `:3005-3010`. |
| `_processedBars` / `_processedBarKey` | `indicator-factory.ts:2796-2797` | constructor-local | Execution-history tracking for `time(..., bars_back=...)`; updated at `:3014-3025`. |
| `_requestSecurityState` | `indicator-factory.ts:2800-2807` | constructor-local | Persistent MTF merge state used by `request.security` (`:3883-3946`). |
| `_requestSecurityDiagnosticsSeen` | `indicator-factory.ts:2810` | constructor-local | Dedupes `request.security` diagnostics (`:3654-3667`). |
| `stubsRaw` | `indicator-factory.ts:2918` | constructor-local | Calls `createStubNamespaces()`, which instantiates hidden per-namespace stores. |
| `visualCtx` | `indicator-factory.ts:2930-2933` | constructor-local mutable object | Re-pointed each bar at `:3038-3039`; every wrapped handle reads it indirectly. |
| `stubs` | `indicator-factory.ts:2938-2960` | constructor-local | Persistent visual proxies around `stubsRaw.*`. |
| `_visualEvents` array | `indicator-factory.ts:2965` | per-bar local | The current bar's visual-event sink; exposed through `visualCtx.pushEvent`. |
| `box.currentBarTime` | `stub-namespaces.ts:331`, mutated via `__setBarTime` at `stub-namespaces.ts:504-507` and called from `indicator-factory.ts:2998-3003` | hidden inside `stubsRaw.box` | Auto-bg-colorer support. |
| `line.nextId` / `lineStore` | `stub-namespaces.ts:203-204` | hidden inside `stubsRaw.line` | Drawing-handle ID/source of truth for the PineJS line namespace. |
| `box.nextId` / `boxStore` | `stub-namespaces.ts:329-330` | hidden inside `stubsRaw.box` | Persistent box handles. |
| `label.nextId` / `labelStore` | `stub-namespaces.ts:527-528` | hidden inside `stubsRaw.label` | Persistent label handles. |
| `table.nextId` / `tableStore` | `stub-namespaces.ts:687-688` | hidden inside `stubsRaw.table` | Persistent table handles/cells/merges. |

### 2.2 Standalone transpiled-main path (`generateStandaloneFactory`)

| Holder | Created at | Scope | Details |
| --- | --- | --- | --- |
| `__stubsRaw` | `indicator-factory.ts:4732` | constructor-local | Calls `__createStubNamespaces()`, which instantiates hidden per-namespace stores. |
| `__visualCtx` | `indicator-factory.ts:4733` | constructor-local mutable object | Re-pointed each bar at `:1329-1330`; wrapped handles use it indirectly. |
| `__stubs` | `indicator-factory.ts:4734` | constructor-local | Persistent visual proxies around `__stubsRaw.*`. |
| `__previousBarTime` | `indicator-factory.ts:4736`, updated at `:1896-1897` | constructor-local | Previous bar open time for `__createBarstate`. |
| `__fallbackBarIndex` | `indicator-factory.ts:4737`, updated at `:1309-1311` | constructor-local | Bar-index fallback. |
| `__processedBars` / `__processedBarKey` | `indicator-factory.ts:4738-4739`, updated at `:1312-1321` | constructor-local | `time(..., bars_back=...)` history tracking. |
| `__requestSecurityState` | `indicator-factory.ts:4740`, used at `:1626-1667` | constructor-local | Persistent MTF merge state. |
| `__requestSecurityCallCounter` | `indicator-factory.ts:4741`, reset each bar at `:1301`, incremented at `:1611` | constructor-local | Ordinal call-site keying for `request.security`. |
| `_visualEvents` array | `indicator-factory.ts:1300` | per-bar local | The current bar's visual-event sink; exposed through `__visualCtx.pushEvent`. |
| `box.currentBarTime` | `indicator-factory.ts:259`, mutated via `:380-383` and called from `:1471-1474` | hidden inside `__stubsRaw.box` | Auto-bg-colorer support. |
| `line.nextId` / `lineStore` | `indicator-factory.ts:169-170` | hidden inside `__stubsRaw.line` | Persistent standalone line handles. |
| `box.nextId` / `boxStore` | `indicator-factory.ts:257-258` | hidden inside `__stubsRaw.box` | Persistent standalone box handles. |
| `label.nextId` / `labelStore` | `indicator-factory.ts:398-399` | hidden inside `__stubsRaw.label` | Persistent standalone label handles. |
| `table.nextId` / `tableStore` | `indicator-factory.ts:500-501` | hidden inside `__stubsRaw.table` | Persistent standalone table handles/cells/merges. |

## 3. Exact differences between the current PineJS and standalone implementations

### 3.1 Duplicated runtime namespaces (`stub-namespaces.ts` vs `STANDALONE_RUNTIME_HELPERS`)

| Primitive | PineJS path provides | Standalone path provides | Drift |
| --- | --- | --- | --- |
| `line.new(...)` | Stores `color`/`style`/`width` from `args[4..6]` and has no `xloc`/`extend` fields (`stub-namespaces.ts:282-317`) | Stores `xloc`/`extend`/`color`/`style`/`width` from `args[4..8]` (`indicator-factory.ts:222-252`) | ABI drift on positional arg mapping; same emitted call stream is read differently. |
| `line` constants | `style_solid`, `style_dashed`, `style_dotted`, `style_arrow_left`, `style_arrow_right`, `style_arrow_both` (`stub-namespaces.ts:306-316`) | `style_solid`, `style_dotted`, `style_dashed` only (`indicator-factory.ts:249-252`) | Standalone is missing arrow styles. |
| `box.new(...)` | Stores `text_halign` and `text_valign` at `args[13]` and `args[14]` (`stub-namespaces.ts:463-482`) | Stops at `text_color` / `args[12]` (`indicator-factory.ts:343-361`) | Standalone drops two canonical fields. |
| `box.__getActiveBgcolor()` | Returns only color-like `bgcolor` / `border_color` strings after validation (`stub-namespaces.ts:508-519`) | Returns any truthy `bgcolor` or `border_color` (`indicator-factory.ts:384-391`) | Auto-bg-colorer can observe different values. |
| `label.new(...)` | Stores `textalign` (`args[9]`) and `tooltip` (`args[10]`) (`stub-namespaces.ts:625-640`) | Stops at `size` / `args[8]` (`indicator-factory.ts:462-476`) | Standalone drops initial tooltip/text alignment. |
| `label` constants | Full glyph + corner-style set (`stub-namespaces.ts:655-680`) | Only `style_label_up/down/left/right` (`indicator-factory.ts:491-495`) | Standalone is missing most `label.style_*` values. |
| `table.cell(...)` | Dense canonical mapping: `textColor=args[4]`, `textHalign=args[5]`, `textSize=args[6]`, `bgcolor=args[7]`, `tooltip=args[8]`, `textValign=args[9]` (`stub-namespaces.ts:692-705`) | Sparse mapping: `textColor=args[6]`, `textSize=args[9]`, `bgcolor=args[10]`, `tooltip=args[11]`; no `textHalign` / `textValign` (`indicator-factory.ts:503-514`) | Standalone reads a different arg ABI and drops alignment fields. |
| `table.clear(...)` | Supports optional region arguments (`startCol`, `startRow`, `endCol`, `endRow`) (`stub-namespaces.ts:708-730`) | Always clears all cells/merges, ignoring region args (`indicator-factory.ts:516-521`) | Visible behavior mismatch. |
| `createStubNamespaces()` return shape | Returns `box`, `line`, `label`, `table`, `str`, `barstate` (`stub-namespaces.ts:795-930`) | Returns `box`, `line`, `label`, `table`, `str` only (`indicator-factory.ts:608-615`) | Return object shape differs, even though both factory paths build `barstate` separately. |
| `str` namespace | `tostring`, `tonumber`, `length`, `contains`, `startswith`, `endswith`, `upper`, `lower`, `replace_all`, `trim`, `split`, `pos`, `substring`, `format`, `format_time` (`stub-namespaces.ts:801-927`) | Same visible method set (`indicator-factory.ts:556-605`) | Surface matches; no material ABI drift found here. |

### 3.2 Other factory-level ABI differences the shared Runtime must account for

These are not part of `stub-namespaces.ts`, but they are still runtime ABI differences between the two factory paths:

| Primitive | PineJS path | Standalone path | Difference |
| --- | --- | --- | --- |
| Compiled-script param order | `log` is passed before `xloc` (`indicator-factory.ts:2816-2883`, invoked at `:4126-4193`) | `log` is the final parameter after `ohlc4` (`indicator-factory.ts:1756-1823`, invoked at `:1827-1894`) | The wrapper ABI order is not identical across paths. |
| `timeframe.in_seconds` | Always returns `60` and ignores the requested timeframe (`mock-factories.ts:285-299`) | Computes seconds from the requested/current timeframe (`indicator-factory.ts:1159-1171`) | Same namespace, different behavior. |
| `syminfo` | Fixed placeholders like `ticker='TICKER'`, `tickerid='EXCHANGE:TICKER'` (`mock-factories.ts:321-337`) | Uses `context.symbol.*` when available (`indicator-factory.ts:1210-1226`) | Standalone is materially richer. |
| `ticker` | Callable placeholder proxy only (`indicator-factory.ts:3564-3577`, `:3616-3620`) | Real `ticker.new(...args.join(':'))` and `ticker.modify(sym)` (`indicator-factory.ts:1737-1740`) | Different surface/semantics. |
| `request` / `request.security` | Proxy-backed `request`; unknown members fall back to iterable-NaN; emits diagnostics and dedupes them (`indicator-factory.ts:3634-3959`) | Plain `{ security }`; no diagnostics side-channel; no fallback proxy (`indicator-factory.ts:1589-1671`) | Same feature area, different surrounding ABI. |
| `array` | Proxy that returns iterable-NaN fallbacks (`indicator-factory.ts:3957-3960`) | Real namespace with constructors/mutators (`indicator-factory.ts:1253-1288`, used at `:1672`) | Very different capability level. |

## 4. What the future shared Runtime module must satisfy

The minimum ABI contract implied by the current code is:

1. A constructor-time factory must be able to produce raw namespaces with hidden per-instance state (`box`, `line`, `label`, `table`, `str`) and then wrap them once in persistent visual proxies.
2. The raw drawing namespaces must preserve handle identity across bars, because wrapped handle methods rely on mutable `visualCtx` indirection (`indicator-factory.ts:2920-2938`, `:2341-2359`).
3. The standalone bundle must expose stable top-level helper names that the emitted factory can call without `import` or `new Function`.
4. Any consolidation that claims "per-instance state only" must move today’s `colorToSlot` map out of the PineJS factory closure and into constructor-owned state (`indicator-factory.ts:2721-2728`).
