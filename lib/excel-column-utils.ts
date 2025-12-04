/**
 * Excel-like Column Utilities
 * Provides utilities for Excel-style column resizing and auto-fit functionality
 */

/**
 * Calculate the optimal width for a column based on its content
 * Similar to Excel's double-click auto-fit feature
 */
export function calculateOptimalColumnWidth(
  columnId: string,
  data: any[],
  headerText: string,
  minWidth: number = 100,
  maxWidth: number = 600,
  padding: number = 40 // Extra padding for cell content
): number {
  // Create a temporary canvas to measure text width
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) return minWidth;

  // Set font to match table styling (slightly larger for safety)
  context.font = '600 14px Inter, system-ui, sans-serif';

  // Measure header text width
  let maxContentWidth = context.measureText(headerText).width;

  // Sample up to 50 rows for performance
  const sampleSize = Math.min(data.length, 50);
  const step = Math.max(1, Math.floor(data.length / sampleSize));

  for (let i = 0; i < data.length; i += step) {
    const row = data[i];
    let cellValue = '';

    // Get cell value - handle nested properties
    const keys = columnId.split('.');
    let value: any = row;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }

    // Convert value to string
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        // Handle arrays, dates, etc.
        if (Array.isArray(value)) {
          cellValue = value.length > 0 ? String(value[0]) : '';
        } else if (value instanceof Date) {
          cellValue = value.toLocaleDateString();
        } else {
          cellValue = JSON.stringify(value);
        }
      } else {
        cellValue = String(value);
      }
    }

    // Measure cell content width
    if (cellValue) {
      const textWidth = context.measureText(cellValue).width;
      maxContentWidth = Math.max(maxContentWidth, textWidth);
    }
  }

  // Add padding and constrain to min/max
  const optimalWidth = Math.min(Math.max(maxContentWidth + padding, minWidth), maxWidth);

  return Math.round(optimalWidth);
}

/**
 * Auto-fit all columns in a table based on their content
 */
export function autoFitAllColumns(
  table: any,
  data: any[],
  minWidth: number = 100,
  maxWidth: number = 600
): Record<string, number> {
  const newSizing: Record<string, number> = {};

  table.getAllLeafColumns().forEach((column: any) => {
    if (column.getCanResize()) {
      const headerText = typeof column.columnDef.header === 'string' 
        ? column.columnDef.header 
        : column.id;

      const optimalWidth = calculateOptimalColumnWidth(
        column.id,
        data,
        headerText,
        minWidth,
        maxWidth
      );

      newSizing[column.id] = optimalWidth;
    }
  });

  return newSizing;
}

/**
 * Auto-fit a single column based on its content
 */
export function autoFitColumn(
  column: any,
  data: any[],
  minWidth: number = 100,
  maxWidth: number = 600
): number {
  const headerText = typeof column.columnDef.header === 'string' 
    ? column.columnDef.header 
    : column.id;

  return calculateOptimalColumnWidth(
    column.id,
    data,
    headerText,
    minWidth,
    maxWidth
  );
}

/**
 * Excel-like table configuration for TanStack Table
 * Use this configuration for consistent Excel-like behavior across all tables
 */
export const excelTableConfig = {
  enableRowSelection: true,
  enableColumnResizing: true,
  columnResizeMode: 'onChange' as const, // Real-time resize feedback
  columnResizeDirection: 'ltr' as const, // Only resize the column being dragged
};

/**
 * Excel-like resize handle props
 * Use these props for consistent resize handle styling
 */
export function getResizeHandleProps(header: any, onDoubleClick?: () => void) {
  return {
    onMouseDown: header.getResizeHandler(),
    onTouchStart: header.getResizeHandler(),
    onDoubleClick: onDoubleClick || (() => {}),
    className: `absolute right-0 top-0 h-full cursor-col-resize select-none touch-none group/resize z-10 ${
      header.column.getIsResizing() ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-400'
    }`,
    style: {
      width: header.column.getIsResizing() ? '3px' : '8px',
      marginRight: header.column.getIsResizing() ? '0' : '-4px',
    },
    title: 'Drag to resize, double-click to auto-fit',
  };
}

/**
 * Excel-like table layout styles
 * Use these styles for consistent table behavior
 */
export const excelTableStyles = {
  table: {
    tableLayout: 'fixed' as const,
  },
  container: {
    overflowX: 'auto' as const,
    overflowY: 'auto' as const,
  },
};

