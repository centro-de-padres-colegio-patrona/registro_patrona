const { execSync } = require('child_process');

// Función para obtener el branch activo
function getGitBranch() {
  // 1. Intentar variable de entorno de Render
  if (process.env.RENDER_GIT_BRANCH) {
    return process.env.RENDER_GIT_BRANCH;
  }
  // 2. Intentar ejecutar comando local de git
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    return 'main'; // Fallback por defecto si no se detecta git
  }
}

// Función para obtener el último commit (Hash corto de 7 caracteres o Hash completo)
function getGitLastCommit(short = true) {
  // 1. Intentar variable de entorno de Render
  if (process.env.RENDER_GIT_COMMIT) {
    const commit = process.env.RENDER_GIT_COMMIT.trim();
    return short ? commit.substring(0, 7) : commit;
  }

  // 2. Intentar ejecutar comando local de git
  try {
    const command = short 
      ? 'git rev-parse --short HEAD' 
      : 'git rev-parse HEAD';
      
    return execSync(command).toString().trim();
  } catch (e) {
    return 'unknown'; // Fallback en caso de no estar en un entorno git
  }
}

/**
 * Verifica si la rama actual contiene el último commit de la rama objetivo (ej: 'desarrollo')
 * @param {string} targetBranch Rama contra la cual verificar (por defecto 'origin/desarrollo')
 * @returns {boolean} true si la rama actual está al día/rebaseada, false en caso contrario.
 */
function isRebasedWith(targetBranch = 'origin/desarrollo') {
  try {
    // 1. Si targetBranch no especifica remoto (ej: "desarrollo"), extraer el nombre para el fetch
    const branchName = targetBranch.includes('/') 
      ? targetBranch.split('/')[1] 
      : targetBranch;

    // 2. Fetch silencioso para tener los últimos commits de la rama remota
    execSync(`git fetch origin ${branchName}`, { stdio: 'ignore' });

    // 3. Ejecutar merge-base. Retorna exit status 0 (true) si targetBranch es ancestro de HEAD
    execSync(`git merge-base --is-ancestor ${targetBranch} HEAD`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    // Si la rama no existe, no hay git o 'merge-base' falla (retorna exit code 1), no está rebaseado
    return false;
  }
}

const currentBranch = getGitBranch();
// Si la rama es 'main' o 'master', usa la URL base. De lo contrario, inyecta la rama.
const branchSubdomain = (currentBranch === 'produccion' )
  ? 'registro-patrona'
  : `registro-patrona-${currentBranch}`;

/*const BASEURL = (PORT === LOCAL_PORT)
  ? 'https://unhappily-correct-squeeze.ngrok-free.dev'
  : `https://${branchSubdomain}.onrender.com`;*/

const BASEURL = `https://${branchSubdomain}.onrender.com`;


module.exports.BASEURL = BASEURL;
module.exports.isRebasedWith = isRebasedWith;
module.exports.currentBranch = currentBranch;
