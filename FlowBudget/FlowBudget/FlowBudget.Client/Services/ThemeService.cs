namespace FlowBudget.Client.Services;

/// <summary>
/// Singleton that holds the active dark-mode flag and notifies subscribers (e.g. MainLayout)
/// when it changes, so the theme flips instantly without a page reload.
/// </summary>
public class ThemeService
{
    private bool _isDarkMode;

    public bool IsDarkMode => _isDarkMode;

    /// <summary>Fired on the calling thread whenever the theme changes.</summary>
    public event Action? OnThemeChanged;

    public void SetDarkMode(bool isDark)
    {
        if (_isDarkMode == isDark) return;
        _isDarkMode = isDark;
        OnThemeChanged?.Invoke();
    }
}
