export declare const DRAWING_REGISTRY: {
    readonly box: {
        readonly name: "box";
        readonly functions: {
            readonly new: {
                readonly canonicalArgs: readonly ["left", "top", "right", "bottom", "border_color", "border_width", "border_style", "extend", "xloc", "bgcolor", "text", "text_size", "text_color", "text_halign", "text_valign", "text_wrap", "force_overlay", "text_font_family"];
                readonly handleFields: {
                    readonly left: "left";
                    readonly top: "top";
                    readonly right: "right";
                    readonly bottom: "bottom";
                    readonly border_color: "border_color";
                    readonly border_width: "border_width";
                    readonly border_style: "border_style";
                    readonly extend: "extend";
                    readonly xloc: "xloc";
                    readonly bgcolor: "bgcolor";
                    readonly text: "text";
                    readonly text_size: "text_size";
                    readonly text_color: "text_color";
                    readonly text_halign: "text_halign";
                    readonly text_valign: "text_valign";
                    readonly text_wrap: "text_wrap";
                    readonly force_overlay: "force_overlay";
                    readonly text_font_family: "text_font_family";
                };
                readonly visualEventArgs: readonly ["left", "top", "right", "bottom", "border_color", "border_width", "border_style", "extend", "xloc", "bgcolor", "text", "text_size", "text_color", "text_halign", "text_valign", "text_wrap", "force_overlay", "text_font_family"];
            };
            readonly delete: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly set_left: {
                readonly canonicalArgs: readonly ["id", "left"];
            };
            readonly set_right: {
                readonly canonicalArgs: readonly ["id", "right"];
            };
            readonly set_top: {
                readonly canonicalArgs: readonly ["id", "top"];
            };
            readonly set_bottom: {
                readonly canonicalArgs: readonly ["id", "bottom"];
            };
            readonly set_extend: {
                readonly canonicalArgs: readonly ["id", "extend"];
            };
            readonly set_bgcolor: {
                readonly canonicalArgs: readonly ["id", "color"];
            };
            readonly set_border_color: {
                readonly canonicalArgs: readonly ["id", "color"];
            };
            readonly set_border_width: {
                readonly canonicalArgs: readonly ["id", "width"];
            };
            readonly set_text_color: {
                readonly canonicalArgs: readonly ["id", "color"];
            };
            readonly get_left: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly get_right: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly get_top: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly get_bottom: {
                readonly canonicalArgs: readonly ["id"];
            };
        };
        readonly constants: readonly [];
    };
    readonly line: {
        readonly name: "line";
        readonly functions: {
            readonly new: {
                readonly canonicalArgs: readonly ["x1", "y1", "x2", "y2", "xloc", "extend", "color", "style", "width", "force_overlay"];
                readonly handleFields: {
                    readonly x1: "x1";
                    readonly y1: "y1";
                    readonly x2: "x2";
                    readonly y2: "y2";
                    readonly xloc: "xloc";
                    readonly extend: "extend";
                    readonly color: "color";
                    readonly style: "style";
                    readonly width: "width";
                    readonly force_overlay: "force_overlay";
                };
                readonly visualEventArgs: readonly ["x1", "y1", "x2", "y2", "xloc", "extend", "color", "style", "width", "force_overlay"];
            };
            readonly delete: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly set_x2: {
                readonly canonicalArgs: readonly ["id", "x2"];
            };
            readonly set_xy1: {
                readonly canonicalArgs: readonly ["id", "x", "y"];
            };
            readonly set_xy2: {
                readonly canonicalArgs: readonly ["id", "x", "y"];
            };
            readonly set_color: {
                readonly canonicalArgs: readonly ["id", "color"];
            };
            readonly get_x2: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly get_y1: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly get_y2: {
                readonly canonicalArgs: readonly ["id"];
            };
        };
        readonly constants: readonly [{
            readonly name: "style_solid";
            readonly value: "solid";
        }, {
            readonly name: "style_dashed";
            readonly value: "dashed";
        }, {
            readonly name: "style_dotted";
            readonly value: "dotted";
        }, {
            readonly name: "style_arrow_left";
            readonly value: "arrow_left";
        }, {
            readonly name: "style_arrow_right";
            readonly value: "arrow_right";
        }, {
            readonly name: "style_arrow_both";
            readonly value: "arrow_both";
        }];
    };
    readonly label: {
        readonly name: "label";
        readonly functions: {
            readonly new: {
                readonly canonicalArgs: readonly ["x", "y", "text", "xloc", "yloc", "color", "style", "textcolor", "size", "textalign", "tooltip", "text_font_family", "force_overlay", "text_formatting"];
                readonly handleFields: {
                    readonly x: "x";
                    readonly y: "y";
                    readonly text: "text";
                    readonly xloc: "xloc";
                    readonly yloc: "yloc";
                    readonly color: "color";
                    readonly style: "style";
                    readonly textcolor: "textcolor";
                    readonly size: "size";
                    readonly textalign: "textalign";
                    readonly tooltip: "tooltip";
                    readonly text_font_family: "text_font_family";
                    readonly force_overlay: "force_overlay";
                    readonly text_formatting: "text_formatting";
                };
                readonly visualEventArgs: readonly ["x", "y", "text", "xloc", "yloc", "color", "style", "textcolor", "size", "textalign", "tooltip", "text_font_family", "force_overlay", "text_formatting"];
            };
            readonly delete: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly set_text: {
                readonly canonicalArgs: readonly ["id", "text"];
            };
            readonly get_text: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly set_tooltip: {
                readonly canonicalArgs: readonly ["id", "tooltip"];
            };
            readonly set_textcolor: {
                readonly canonicalArgs: readonly ["id", "color"];
            };
            readonly set_style: {
                readonly canonicalArgs: readonly ["id", "style"];
            };
            readonly set_xy: {
                readonly canonicalArgs: readonly ["id", "x", "y"];
            };
            readonly set_x: {
                readonly canonicalArgs: readonly ["id", "x"];
            };
            readonly set_y: {
                readonly canonicalArgs: readonly ["id", "y"];
            };
            readonly get_y: {
                readonly canonicalArgs: readonly ["id"];
            };
        };
        readonly constants: readonly [{
            readonly name: "style_none";
            readonly value: "none";
        }, {
            readonly name: "style_xcross";
            readonly value: "xcross";
        }, {
            readonly name: "style_cross";
            readonly value: "cross";
        }, {
            readonly name: "style_triangleup";
            readonly value: "triangleup";
        }, {
            readonly name: "style_triangledown";
            readonly value: "triangledown";
        }, {
            readonly name: "style_flag";
            readonly value: "flag";
        }, {
            readonly name: "style_circle";
            readonly value: "circle";
        }, {
            readonly name: "style_arrowup";
            readonly value: "arrowup";
        }, {
            readonly name: "style_arrowdown";
            readonly value: "arrowdown";
        }, {
            readonly name: "style_square";
            readonly value: "square";
        }, {
            readonly name: "style_diamond";
            readonly value: "diamond";
        }, {
            readonly name: "style_label_up";
            readonly value: "label_up";
        }, {
            readonly name: "style_label_down";
            readonly value: "label_down";
        }, {
            readonly name: "style_label_left";
            readonly value: "label_left";
        }, {
            readonly name: "style_label_right";
            readonly value: "label_right";
        }, {
            readonly name: "style_label_lower_left";
            readonly value: "label_lower_left";
        }, {
            readonly name: "style_label_lower_right";
            readonly value: "label_lower_right";
        }, {
            readonly name: "style_label_upper_left";
            readonly value: "label_upper_left";
        }, {
            readonly name: "style_label_upper_right";
            readonly value: "label_upper_right";
        }, {
            readonly name: "style_label_center";
            readonly value: "label_center";
        }];
    };
    readonly linefill: {
        readonly name: "linefill";
        readonly functions: {
            readonly new: {
                readonly canonicalArgs: readonly ["line1", "line2", "color"];
                readonly handleFields: {
                    readonly line1: "line1";
                    readonly line2: "line2";
                    readonly color: "color";
                };
                readonly visualEventArgs: readonly ["line1", "line2", "color"];
            };
            readonly delete: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly set_color: {
                readonly canonicalArgs: readonly ["id", "color"];
            };
            readonly get_line1: {
                readonly canonicalArgs: readonly ["id"];
            };
            readonly get_line2: {
                readonly canonicalArgs: readonly ["id"];
            };
        };
        readonly constants: readonly [];
    };
    readonly table: {
        readonly name: "table";
        readonly functions: {
            readonly new: {
                readonly canonicalArgs: readonly ["position", "columns", "rows", "bgcolor", "frame_color", "frame_width", "border_color", "border_width", "force_overlay"];
                readonly handleFields: {
                    readonly position: "position";
                    readonly columns: "columns";
                    readonly rows: "rows";
                    readonly bgcolor: "bgcolor";
                    readonly frame_color: "frame_color";
                    readonly frame_width: "frame_width";
                    readonly border_color: "border_color";
                    readonly border_width: "border_width";
                    readonly force_overlay: "force_overlay";
                };
                readonly visualEventArgs: readonly ["position", "columns", "rows", "bgcolor", "frame_color", "frame_width", "border_color", "border_width", "force_overlay"];
            };
            readonly cell: {
                readonly canonicalArgs: readonly ["table_id", "column", "row", "text", "width", "height", "text_color", "text_halign", "text_valign", "text_size", "bgcolor", "tooltip", "text_font_family", "text_formatting"];
                readonly visualEventArgs: readonly ["table_id", "column", "row", "text", "width", "height", "text_color", "text_halign", "text_valign", "text_size", "bgcolor", "tooltip", "text_font_family", "text_formatting"];
            };
            readonly clear: {
                readonly canonicalArgs: readonly ["table_id", "start_column", "start_row", "end_column", "end_row"];
            };
            readonly merge_cells: {
                readonly canonicalArgs: readonly ["table_id", "start_column", "start_row", "end_column", "end_row"];
            };
        };
        readonly constants: readonly [];
    };
};
//# sourceMappingURL=drawing.d.ts.map