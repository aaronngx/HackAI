export const addPropertyControls = () => {};

export const ControlType = {
  Number: "number",
  Boolean: "boolean",
  Color: "color",
  Enum: "enum",
  Image: "image",
  String: "string",
  Font: "font",
  Array: "array",
  Object: "object",
  ResponsiveImage: "responsiveimage",
  Transition: "transition",
  File: "file",
  SegmentedEnum: "segmentedenum",
};

export const RenderTarget = {
  current: () => "preview",
  preview: "preview",
  canvas: "canvas",
};
