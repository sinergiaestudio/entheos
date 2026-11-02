"""Private trial of the existing application; never writes the installed data root."""
import os,pathlib,sys
if sys.platform=='win32':
    os.environ['LOCALAPPDATA']=str(pathlib.Path(os.environ['LOCALAPPDATA'])/'ANATHEOS-Experimental'/'study-import-closure')
from entry import main
if __name__=='__main__':raise SystemExit(main())
