import * as cdk from "@aws-cdk/core";
import * as cm from "@aws-cdk/aws-certificatemanager";
import * as route53 from "@aws-cdk/aws-route53";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as autoscaling from "@aws-cdk/aws-autoscaling";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as targets from "@aws-cdk/aws-route53-targets";

export class JenkinscdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: any) {
    super(scope, id, props);
    const { hostedZone: domainName, account, ami, az, region } = props.env;
    const zone = route53.HostedZone.fromLookup(this, "jenkins-dns", {
      privateZone: false,
      domainName
    });

    const certificate = new cm.DnsValidatedCertificate(this, "jenkins-dns-cert", {
      domainName: `${props.env.hostedZone}`,
      validationMethod: cm.ValidationMethod.DNS,
      hostedZone: zone
    });

    const vpc = new ec2.Vpc(this, 'jenkins-vpc');

    const asg = new autoscaling.AutoScalingGroup(this, 'jenkins-master-asg', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
      machineImage: ec2.MachineImage.genericLinux({
        region: ami
      }),
      vpcSubnets: vpc.selectSubnets({
        availabilityZones: [az]
      }),
    });

    const lb = new elbv2.ApplicationLoadBalancer(this, 'jenkins-master-lb', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: [certificate.certificateArn],
    });

    listener.addTargets('Target', {
      port: 8080,
      targets: [asg]
    });

    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

    asg.scaleOnRequestCount('AModestLoad', {
      targetRequestsPerSecond: 1
    });

    new route53.ARecord(this, "jenkins-dns-alias", {
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(lb)
      ),
      zone,
    });
  }
}
