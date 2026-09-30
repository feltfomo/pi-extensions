{ ... }:
{
  programs.pi-coding-agent.extensions = {
    footer-plus = {
      enable = true;
      showReset = true;
      settings.separator = " :: ";
      widgets.session.enable = false;
      widgets.extension-statuses.enable = false;
    };
    session-manager.enable = true;
  };
}
