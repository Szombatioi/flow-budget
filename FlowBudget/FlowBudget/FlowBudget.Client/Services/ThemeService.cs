namespace FlowBudget.Client.Services;


public class ThemeService
{
    private bool _isDarkMode;

    public bool IsDarkMode => _isDarkMode;
    
    public event Action? OnThemeChanged;

    public void SetDarkMode(bool isDark)
    {
        if (_isDarkMode == isDark) return;
        _isDarkMode = isDark;
        OnThemeChanged?.Invoke();
    }
}
