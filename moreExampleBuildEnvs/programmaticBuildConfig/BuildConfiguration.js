function BuildConfiguration() {
    this.projectGroups = {};
}

// Adds the specified projectgroup to the  buildConfig
BuildConfiguration.prototype.addProjectGroup = function (projectGroup) {
    buildConfig.projectGroups = buildConfig.projectGroups;
    buildConfig.projectGroups[projectGroup.name] = projectGroup;
    return projectGroup;
}

// Adds a project to a projectgroup
BuildConfiguration.prototype.addProjectToProjectGroup = function (project, projectGroup) {
    if (!project.name || !project.path)
        throw Error("Need to specify name and path on project");
    projectGroup.projects[project.name] = project;
    return project;
}

// Shortcut; creates a new ProjectGroup and assigns the project to it.  Name of projectgroup = project.name
BuildConfiguration.prototype.addProject = function (project) {
    var projectGroup = this.addProjectGroup({
        name: project.name,
        projects: {}
    });
    return this.addProjectToProjectGroup(project, projectGroup);
}
