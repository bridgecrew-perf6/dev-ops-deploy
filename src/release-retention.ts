import * as fs from 'fs/promises'

export interface Release {
  Id: string
  ProjectId: string
  Version?: string | null
  Created?: string | null
}

export interface Environment {
  Id: string
  Name: string
}

export interface Deployment {
  Id: string
  ReleaseId: string
  EnvironmentId: string
  DeployedAt: string
}

export interface Project {
  Id: string
  Name: string
}

export interface DeployedRelease {
  Id: string
  Version?: string | null
  DeployedAt: string
}

export async function readFile(path: string) {
  const a = await fs.readFile(path, 'utf-8')
  const things: Release[] = JSON.parse(a)
  console.log(things)
}

export const filterReleasesWithNoDeploymentsOrProjects = (
  releases: Release[],
  deployments: Deployment[],
  projects: Project[]
): Release[] => {
  const releasesWithDeployments = releases.filter((release) => {
    if (deployments.some((deployment) => deployment.ReleaseId === release.Id)) {
      return true
    }
    return false
  })

  // I'm assuming that if a release is associated with a Project that isn't in the Projects.json file,
  // then this release should be excluded from the results.
  const releasesWithProjects = releasesWithDeployments.filter((release) => {
    if (projects.some((project) => project.Id === release.ProjectId)) {
      return true
    }
    return false
  })

  return releasesWithProjects
}

const convertIndexToEnglishString = (index: number) => {
  switch (index) {
    case 0:
      return 'most recently'
    case 1:
      return index + 1 + 'nd most recently'
    case 2:
      return index + 1 + 'rd most recently'
    default:
      return index + 1 + 'th most recently'
  }
}

export const orderAndFilterReleases = (
  numberOfPastReleaseToRetain: number,
  releasesMap: Record<string, DeployedRelease[]>
): string[] => {
  return Object.entries(releasesMap)
    .map(([key, value]) => {
      const environment = key.split(':')
      console.log(
        `For enviroment and project ${key}, the retained releases are:`
      )
      return value
        .sort((a, b) => {
          return Date.parse(b.DeployedAt) - Date.parse(a.DeployedAt)
        })
        .slice(0, numberOfPastReleaseToRetain)
        .map((release, index) => {
          console.log(
            `${
              release.Id
            } kept becasue it was the ${convertIndexToEnglishString(
              index
            )} deployed to ${environment[0]} `
          )
          return release.Id
        })
    })
    .flat()
}

export const calculateReleasesToRetain = (
  numberOfPastReleaseToRetain: number,
  releases: Release[],
  deployments: Deployment[],
  projects: Project[],
  environments: Environment[]
): string[] => {
  const filteredReleases = filterReleasesWithNoDeploymentsOrProjects(
    releases,
    deployments,
    projects
  )

  // TODO Returm a new object built up in the below function instead of declaring one and then mutating it
  const releasesObject: Record<string, DeployedRelease[]> = {}
  filteredReleases.map((release) => {
    const releaseDeployments = deployments.filter(
      (deploy) => deploy.ReleaseId === release.Id
    )

    releaseDeployments.flatMap((deploy) => {
      // I'm assuming that if a deployment was to an enviroment that isn't
      // in the Environments list then it should be filtered out
      if (
        !environments.some(
          (environment) => environment.Id === deploy.EnvironmentId
        )
      ) {
        return []
      }

      // TODO Use .reduce here to build the object instead of mutating the releases object
      const existingReleases =
        releasesObject[`${deploy.EnvironmentId}:${release.ProjectId}`]

      if (existingReleases) {
        existingReleases.push({
          Id: release.Id,
          Version: release.Version,
          DeployedAt: deploy.DeployedAt,
        })
      } else {
        releasesObject[`${deploy.EnvironmentId}:${release.ProjectId}`] = [
          {
            Id: release.Id,
            Version: release.Version,
            DeployedAt: deploy.DeployedAt,
          },
        ]
      }
    })
  })

  // I'm assuming that for the instruction to "Return the releases that should be kept", the Release Id is the only detail that needs
  // to be returned (if this assumption is incorrect it is easy enough to change)
  return orderAndFilterReleases(numberOfPastReleaseToRetain, releasesObject)
}
