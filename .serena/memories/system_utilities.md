# System Utilities for Zeus Development (macOS/Darwin)

## Platform-Specific Commands
The project runs on Darwin (macOS), so system commands follow BSD/macOS conventions:

### File System Operations
- `ls -la` - List files with detailed permissions (BSD ls)
- `find . -name "*.ts" -type f` - Find TypeScript files
- `grep -r "pattern" src/` - Search for patterns in source code
- `cd /path/to/directory` - Change directory
- `pwd` - Print working directory
- `mkdir -p path/to/dir` - Create directories recursively
- `rm -rf directory` - Remove directories recursively (use with caution)
- `cp -r source dest` - Copy files/directories recursively
- `mv source dest` - Move/rename files

### Text Processing (BSD versions)
- `grep -E "regex" file.ts` - Extended regex search
- `sed -i '' 's/old/new/g' file.ts` - In-place substitution (note empty string after -i)
- `awk '{print $1}' file.txt` - Text processing
- `sort file.txt` - Sort lines
- `uniq file.txt` - Remove duplicate lines
- `head -n 10 file.txt` - First 10 lines
- `tail -n 10 file.txt` - Last 10 lines
- `wc -l file.txt` - Count lines

### Development Utilities
- `which node` - Find Node.js executable path
- `which npm` - Find npm executable path  
- `node --version` - Check Node.js version (must be 22+)
- `npm --version` - Check npm version
- `forge --version` - Check Foundry Forge version

### Process Management
- `ps aux | grep node` - Find Node.js processes
- `kill -9 <pid>` - Force kill process by PID
- `jobs` - List background jobs
- `bg` - Send job to background
- `fg` - Bring job to foreground

### Network Utilities
- `curl -s https://api.github.com` - HTTP requests
- `ping -c 4 github.com` - Network connectivity test
- `netstat -an | grep LISTEN` - List listening ports

### Git Operations (commonly used)
- `git status` - Check working tree status
- `git log --oneline -10` - Recent commits
- `git diff` - Show unstaged changes
- `git diff --cached` - Show staged changes
- `git branch -a` - List all branches
- `git checkout -b feature/branch-name` - Create and switch to new branch

### macOS-Specific
- `open .` - Open current directory in Finder
- `open -a "Visual Studio Code" .` - Open directory in VS Code
- `pbcopy < file.txt` - Copy file contents to clipboard
- `pbpaste > file.txt` - Paste clipboard to file
- `say "build complete"` - Text-to-speech notification

### Monitoring & Debugging
- `top` - Process monitor
- `htop` - Enhanced process monitor (if installed)
- `du -sh *` - Directory sizes
- `df -h` - Disk usage
- `free` - Memory usage (Linux) / `vm_stat` (macOS)
- `lsof -i :3000` - Find process using port 3000

### Package Management (if using Homebrew)
- `brew list` - List installed packages
- `brew search package-name` - Search for packages
- `brew install package-name` - Install packages
- `brew upgrade` - Update all packages