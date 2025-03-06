import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import CodeMirror from '@uiw/react-codemirror';
import { FC, useEffect, useState } from 'react';
// import  'styles/global.css';
interface Props {
  code: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}


export const JsonOut: FC<Props> = ({
  code,
  editable = false,
  onChange = () => {},
}) => {
  const [copyText, setCopyText] = useState<string>('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCopyText('');
    }, 2000);

    return () => clearTimeout(timeout);
  }, [copyText]);

  return (
<div className="relative bg-[#1A1B26] rounded-lg ">
       <button
        className=" rounded pt-4 text-xs text-white hover:bg-[#2D2E3A] active:bg-[#2D2E3A]"
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopyText('Copied!');
          }).catch(() => {
            setCopyText('Failed to copy');
          });
        }}
      >
        {copyText}
      </button>
      <div style={{ borderRadius: '8px', overflow: 'hidden', paddingLeft:"9px", paddingRight:"0px"  }}>
        <CodeMirror
          editable={editable}
          value={code}
          minHeight="500px"
  
          extensions={[StreamLanguage.define(go)]}
          theme={tokyoNight}
          onChange={(value, viewUpdate) => {
            onChange(value);
            
          }}
        />
      </div>
    </div>
  );
};


export default JsonOut;