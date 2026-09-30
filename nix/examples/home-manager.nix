{ ... }:
{
  programs.pi-coding-agent.extensions.status-lines = {
    enable = true;
    showReset = true;
    settings.separator = " :: ";
  };
}
