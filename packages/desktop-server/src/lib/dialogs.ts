import { exec, undent } from '@bscotch/utility';
export async function pickFolder(): Promise<string | undefined> {
  const folderToSearch = (
    await exec('powershell', [
      undent`
          Add-Type -AssemblyName System.windows.forms | Out-Null;
          $f = New-Object System.Windows.Forms.FolderBrowserDialog;
          $f.ShowNewFolderButton = $false;
          $f.Description = "Choose a folder that contains one or more GameMaker project files. The folder will be searched recursively.";
          $f.ShowDialog() | Out-Null;
          $f.SelectedPath`,
    ])
  ).stdout.trim();
  return folderToSearch;
}
