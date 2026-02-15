declare module 'react-scroll-to-bottom' {
  import { ComponentType, HTMLAttributes } from 'react';

  interface ScrollToBottomProps extends HTMLAttributes<HTMLDivElement> {
    className?: string;
    followButtonClassName?: string;
    mode?: 'bottom' | 'top';
    checkInterval?: number;
    scrollViewClassName?: string;
    children?: React.ReactNode;
  }

  declare const ScrollToBottom: ComponentType<ScrollToBottomProps>;
  
  export default ScrollToBottom;
  
  export function useScrollToBottom(): () => void;
  export function useSticky(): [boolean, () => void];
  export function useAtEnd(): boolean;
  export function useAtTop(): boolean;
}