from pathlib import Path
path = Path('src/features/schedule/TimeBlock.tsx')
text = path.read_text(encoding='utf-8')
start = text.index('  return (')
end = text.index('  );\r\n});', start)
new_block = """  return (\n    <div\n      className={blockClassName}\n      data-block-id={block.id}\n      onDragOver={handleDragOver}\n      onDragLeave={handleDragLeave}\n      onDrop={handleDropWrapper}\n    >\n      <div className={blockHeaderClass} onClick={() => setIsExpanded(!isExpanded)}>{/* header content */}</div>\n    </div>\n  );"""
new_text = text[:start] + new_block + text[end:]
path.write_text(new_text, encoding='utf-8')
