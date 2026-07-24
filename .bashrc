alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

alias gitch='git checkout'
alias gitst='git status -uno'
alias gitbr='git branch'
alias gitsubupdate='git submodule update --init --recursive'
alias gitsubst='git submodule foreach git status -uno'
alias gitsubrecreset='git submodule foreach --recursive git reset --hard'
alias gitsubrecremote='git submodule update --recursive --remote'
alias gitlg="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
