# Supported Pine Surface

Generated from `src/registry/` by `bun run docs:surface`. Do not edit by hand.

## Drawing Namespaces

### `box`

Functions:
- `box.delete(id)`
- `box.get_bottom(id)`
- `box.get_left(id)`
- `box.get_right(id)`
- `box.get_top(id)`
- `box.new(left, top, right, bottom, border_color, border_width, border_style, extend, xloc, bgcolor, text, text_size, text_color, text_halign, text_valign, text_wrap, force_overlay, text_font_family)`
- `box.set_bgcolor(id, color)`
- `box.set_border_color(id, color)`
- `box.set_border_width(id, width)`
- `box.set_bottom(id, bottom)`
- `box.set_extend(id, extend)`
- `box.set_left(id, left)`
- `box.set_right(id, right)`
- `box.set_text_color(id, color)`
- `box.set_top(id, top)`

Constants:
- None.

### `label`

Functions:
- `label.delete(id)`
- `label.get_text(id)`
- `label.get_y(id)`
- `label.new(x, y, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip, text_font_family, force_overlay, text_formatting)`
- `label.set_style(id, style)`
- `label.set_text(id, text)`
- `label.set_textcolor(id, color)`
- `label.set_tooltip(id, tooltip)`
- `label.set_x(id, x)`
- `label.set_xy(id, x, y)`
- `label.set_y(id, y)`

Constants:
- `label.style_arrowdown` = `arrowdown`
- `label.style_arrowup` = `arrowup`
- `label.style_circle` = `circle`
- `label.style_cross` = `cross`
- `label.style_diamond` = `diamond`
- `label.style_flag` = `flag`
- `label.style_label_center` = `label_center`
- `label.style_label_down` = `label_down`
- `label.style_label_left` = `label_left`
- `label.style_label_lower_left` = `label_lower_left`
- `label.style_label_lower_right` = `label_lower_right`
- `label.style_label_right` = `label_right`
- `label.style_label_up` = `label_up`
- `label.style_label_upper_left` = `label_upper_left`
- `label.style_label_upper_right` = `label_upper_right`
- `label.style_none` = `none`
- `label.style_square` = `square`
- `label.style_triangledown` = `triangledown`
- `label.style_triangleup` = `triangleup`
- `label.style_xcross` = `xcross`

### `line`

Functions:
- `line.delete(id)`
- `line.get_x2(id)`
- `line.get_y1(id)`
- `line.get_y2(id)`
- `line.new(x1, y1, x2, y2, xloc, extend, color, style, width, force_overlay)`
- `line.set_color(id, color)`
- `line.set_x2(id, x2)`
- `line.set_xy1(id, x, y)`
- `line.set_xy2(id, x, y)`

Constants:
- `line.style_arrow_both` = `arrow_both`
- `line.style_arrow_left` = `arrow_left`
- `line.style_arrow_right` = `arrow_right`
- `line.style_dashed` = `dashed`
- `line.style_dotted` = `dotted`
- `line.style_solid` = `solid`

### `linefill`

Functions:
- `linefill.delete(id)`
- `linefill.get_line1(id)`
- `linefill.get_line2(id)`
- `linefill.new(line1, line2, color)`
- `linefill.set_color(id, color)`

Constants:
- None.

### `table`

Functions:
- `table.cell(table_id, column, row, text, width, height, text_color, text_halign, text_valign, text_size, bgcolor, tooltip, text_font_family, text_formatting)`
- `table.clear(table_id, start_column, start_row, end_column, end_row)`
- `table.merge_cells(table_id, start_column, start_row, end_column, end_row)`
- `table.new(position, columns, rows, bgcolor, frame_color, frame_width, border_color, border_width, force_overlay)`

Constants:
- None.

## `input.*` Functions

Supported input helpers:
- `input(defval, title, tooltip, inline, group, display, confirm, options, minval, maxval, step)`
- `input.bool(defval, title, tooltip, inline, group, display, confirm)`
- `input.color(defval, title, tooltip, inline, group, display, confirm)`
- `input.float(defval, title, minval, maxval, step, tooltip, inline, group, display, confirm, options)`
- `input.int(defval, title, minval, maxval, step, tooltip, inline, group, display, confirm, options)`
- `input.price(defval, title, minval, maxval, step, tooltip, inline, group, display, confirm)`
- `input.session(defval, title, options, tooltip, inline, group, display, confirm)`
- `input.source(defval, title, tooltip, inline, group, display, confirm)`
- `input.string(defval, title, options, tooltip, inline, group, display, confirm)`
- `input.symbol(defval, title, tooltip, inline, group, display, confirm)`
- `input.text_area(defval, title, tooltip, inline, group, display, confirm)`
- `input.time(defval, title, tooltip, inline, group, display, confirm)`
- `input.timeframe(defval, title, options, tooltip, inline, group, display, confirm)`

